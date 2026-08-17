// src/_data/listings.js
//
// One entry per listing. The marquee renders this array twice — once for
// real, once aria-hidden as the seamless-loop duplicate — so adding a
// listing here adds it to both passes automatically. Hardcoding the cards
// in the template would mean editing six blocks to change three.

module.exports = [
	{
		address: "215 Oakridge Lane",
		blurb: "A quiet street minutes from the lake, with a rear garden that runs the full depth of the lot.",
		beds: 4,
		baths: 3,
		status: "Featured Listing",
		url: "/home-search/",
		image: "https://cdn.realtor.ca/listings/TS639196433613700000/reb88/highres/0/n13563210_1.jpg",
		alt: "215 Oakridge Lane, a detached home with a deep rear garden",
	},
	{
		address: "12 Elmbank Court",
		blurb: "Detached on a corner lot, walking distance to the GO line and the older shopping strip.",
		beds: 4,
		baths: 3,
		status: "Featured Listing",
		url: "/home-search/",
		image: "https://cdn.realtor.ca/listings/TS639196433613700000/reb88/highres/0/n13563210_1.jpg",
		alt: "12 Elmbank Court, a corner-lot detached home",
	},
	{
		address: "88 Harbourview",
		blurb: "A two-bedroom with north light and a parking spot, priced under the neighbourhood median.",
		beds: 2,
		baths: 2,
		status: "Featured Listing",
		url: "/home-search/",
		image: "https://cdn.realtor.ca/listings/TS639196433613700000/reb88/highres/0/n13563210_1.jpg",
		alt: "88 Harbourview, a two-bedroom apartment building",
	},
];