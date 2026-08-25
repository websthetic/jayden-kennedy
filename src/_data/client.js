module.exports = {
    name: "Jayden Kennedy",
    brokerage: "Keller Williams Energy Real Estate, Brokerage, Independently Owned & Operated",

    //! CONFIRM — the website deck says (289) 943-7934, the brand book business
    //! card and letterhead both say +905-723-5944. Verify before launch.
    email: "jayden@soldbykennedy.ca",
    phoneForTel: "289-943-7934",
    phoneFormatted: "(289) 943-7934",

    address: {
        lineOne: "285 Taunton Road East, Unit 1",
        lineTwo: "",
        city: "Oshawa",
        state: "ON",
        zip: "L1G 3V2",
        country: "CA",
        //! CONFIRM — placeholder, replace with the real listing
        mapLink: "https://maps.google.com/?q=285+Taunton+Road+East+Unit+1+Oshawa+ON",
    },

    socials: {
        //! CONFIRM — handle taken from the brand book business card
        instagram: "https://www.instagram.com/jaydenkennedyrealestate/",
    },

    //! Include the file protocol, and NO TRAILING SLASH
    domain: "https://www.soldbykennedy.ca",

    // Passing the isProduction variable for use in HTML templates
    isProduction: process.env.ELEVENTY_ENV === "PROD",
};