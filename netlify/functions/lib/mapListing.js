/**
 * Maps a raw RESO Property record (with $expand=Media) into the lean shape
 * the front end cards and gallery use. One mapper shared by every function
 * so the homepage, listings, and results cards stay in sync.
 *
 * IDX display flags are honoured here rather than trusted to the caller:
 * a listing with InternetEntireListingDisplayYN false has opted out of
 * public internet display entirely and must not reach the browser, even
 * from a single-agent-scoped feed.
 *
 * Media rows: PropTx returns one row per photo PER SIZE VARIANT (Largest,
 * Large, Medium, Thumbnail, LargestNoWatermark), all sharing MediaObjectID
 * — not one row per photo. They're grouped back into one photo per key
 * before anything picks a "first image". Some size variants (the
 * no-watermark originals) come back with Permission: ["Private"] and are
 * dropped here — those are for the listing agent's own use, never for
 * public display.
 */

// Preferred size for a small card thumbnail vs. a full listing gallery.
const CARD_SIZE_PREFERENCE = ["Medium", "Large", "Largest", "Thumbnail"];
const GALLERY_SIZE_PREFERENCE = ["Large", "Largest", "Medium", "Thumbnail"];

function isPublicPhoto(media) {
  return (
    (media.MediaCategory === "Photo" || !media.MediaCategory) &&
    media.MediaStatus === "Active" &&
    Array.isArray(media.Permission) &&
    media.Permission.includes("Public")
  );
}

/**
 * Collapses the flat, size-duplicated Media array into one entry per
 * photo, sorted by Order (PreferredPhotoYN, when present, wins first).
 */
function groupPhotos(media) {
  if (!Array.isArray(media)) return [];

  const groups = new Map();

  media.filter(isPublicPhoto).forEach((m) => {
    const key = m.MediaObjectID || m.MediaKey;
    if (!groups.has(key)) {
      groups.set(key, { order: m.Order ?? 0, preferred: false, sizes: {} });
    }
    const group = groups.get(key);
    group.sizes[m.ImageSizeDescription || "Original"] = m.MediaURL;
    if (m.PreferredPhotoYN) group.preferred = true;
  });

  return Array.from(groups.values()).sort((a, b) => {
    if (a.preferred !== b.preferred) return a.preferred ? -1 : 1;
    return a.order - b.order;
  });
}

function sizeUrl(photo, preference) {
  if (!photo) return null;
  const size = preference.find((s) => photo.sizes[s]);
  return size ? photo.sizes[size] : Object.values(photo.sizes)[0] || null;
}

function mapListing(property) {
  if (!property) return null;

  // Opted out of internet display entirely — never surface it.
  if (property.InternetEntireListingDisplayYN === false) return null;

  const addressVisible = property.InternetAddressDisplayYN !== false;
  const photos = groupPhotos(property.Media);

  return {
    key: property.ListingKey,
    address: addressVisible ? property.UnparsedAddress : `${property.City} (address withheld)`,
    city: property.City,
    status: property.StandardStatus,
    price: property.ListPrice,
    // //! CONFIRM — ClosePrice and CloseDate are absent from this feed
    // entirely (not null — the keys don't exist on the raw record),
    // verified across every Closed record this token can see. This is
    // an IDX-tier entitlement; sold price is typically VOW-gated at
    // TRREB. closePrice stays here for forward-compatibility only if
    // that entitlement ever changes — do not build UI that assumes it's
    // populated. transactionType/contractDate are what's actually
    // available for a "closings" page.
    closePrice: property.ClosePrice ?? null,
    transactionType: property.TransactionType || null, // "For Sale" | "For Lease"
    contractDate: property.PurchaseContractDate || null, // accepted-offer date; closest available proxy for CloseDate
    beds: property.BedroomsTotal,
    baths: property.BathroomsTotalInteger,
    sqft: property.LivingAreaRange || property.LivingArea || null,
    propertyType: property.PropertySubType || property.PropertyType,
    daysOnMarket: property.DaysOnMarket ?? null,
    modified: property.ModificationTimestamp,
    // Single image sized for a listing card.
    cardPhoto: sizeUrl(photos[0], CARD_SIZE_PREFERENCE),
    // Full ordered set, sized for a gallery, for the listing detail page.
    galleryPhotos: photos.map((p) => sizeUrl(p, GALLERY_SIZE_PREFERENCE)).filter(Boolean),
  };
}

/**
 * Extends mapListing() with the additional fields the listing detail
 * page needs beyond what a search-result card shows — full remarks,
 * carrying-cost inputs, etc. A separate function rather than always
 * including these on mapListing() so list/search responses (12+ cards
 * per page) stay lean; the detail page only ever fetches one record.
 */
function mapListingDetail(property) {
  const base = mapListing(property);
  if (!base) return null;

  return {
    ...base,
    publicRemarks: property.PublicRemarks || null,
    taxAnnualAmount: property.TaxAnnualAmount ?? null,
    taxYear: property.TaxYear ?? null,
    associationFee: property.AssociationFee ?? null,
    associationFeeIncludes: Array.isArray(property.AssociationFeeIncludes) ? property.AssociationFeeIncludes : [],
    parkingTotal: property.ParkingTotal ?? null,
    garageType: property.GarageType || null,
    basement: Array.isArray(property.Basement) ? property.Basement : [],
    crossStreet: property.CrossStreet || null,
  };
}

module.exports = { mapListing, mapListingDetail, groupPhotos, sizeUrl };
