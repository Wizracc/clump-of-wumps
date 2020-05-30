const Discord = require("discord.js");
const { prefix } = require("./config.json");
const fs = require("fs");
const puppeteer = require("puppeteer");
const { DeckEncoder } = require("runeterra");

let raw_data_set1 = fs.readFileSync(
  "./set1-lite-en_us/en_us/data/set1-en_us.json"
);
let raw_data_set2 = fs.readFileSync(
  "./set2-lite-en_us/en_us/data/set2-en_us.json"
);
const data1 = JSON.parse(raw_data_set1);
const data2 = JSON.parse(raw_data_set2);
const data = data1.concat(data2);

function deck_translate(code) {
  const rawDeck = DeckEncoder.decode(code);
}

function card_lookup(args) {
  var string = args.join(" ").toLowerCase();
  var matches = [];
  for (var card of data) {
    if (
      card.descriptionRaw.toLowerCase().includes(string) ||
      card.name.toLowerCase().includes(string) ||
      card.keywords.join(" ").toLowerCase().includes(string)
    ) {
      matches.push(card);
    }
  }
  return matches.sort((a, b) => sort_cards(a, b));
}

function find_card(args) {
  var string = args.join(" ").toLowerCase();
  var matches = new Set();
  for (var card of data.concat(data2)) {
    if (card.name.toLowerCase() === string) {
      matches.add(card);
      for (var subcardCode of card.associatedCardRefs) {
        var subcard = data.find((obj) => {
          return obj.cardCode === subcardCode;
        });
        matches.add(subcard);
      }
    }
  }
  return [...matches].sort((a, b) => sort_cards(a, b, string));
}

/**
 * long_results returns an array of embeds using the given array.
 *
 * This method takes in an array of card objects filtered from
 * the datadragon json, and creates 1 or more embed objects
 * that lists the names, cost, and rarity
 *
 * @param {[objectVar]} cards an array of card objects
 *
 * @return {[objectVar]}      an array of embed objects
 */
function long_results(cards) {
  var embeds = [];
  var freshEmbed = new Discord.MessageEmbed()
    .setTitle("Search Results 1")
    .setFooter(
      `To view an individual card, use ${prefix}card, \nuse reactions to navigate multiple pages \n(un-react to reuse buttons, if no buttons present, only 1 page)`
    );
  var s = " ";
  for (var card of cards) {
    var newLine = "";
    newLine += `${rarity_to_emoji(card.rarity)} `;
    newLine += `__**${card.cost}**__ `;
    newLine += `${card.name}\n`;

    s += newLine;

    if (s.length + newLine.length >= 600) {
      freshEmbed.addFields({
        name: "[Rarity] __**Cost**__ Name",
        value: s,
        inline: true,
      });
      embeds.push(freshEmbed);

      s = " ";
      freshEmbed = new Discord.MessageEmbed()
        .setTitle(`Search Results ${embeds.length + 1}`)
        .setFooter(
          `To view an individual card, use ${prefix}card, \nuse reactions to navigate multiple pages \n(un-react to reuse buttons)`
        );
    }
  }

  freshEmbed.addFields({
    name: "[Rarity] __**Cost**__ Name",
    value: s,
    inline: true,
  });

  embeds.push(freshEmbed);
  return embeds;
}

/*
short_results

returns an array of embeds of all the cards
*/
function short_results(cards) {
  var embeds = [];
  for (card of cards) {
    var freshEmbed = new Discord.MessageEmbed()
      .setTitle(`${region_to_emoji(card.regionRef)} ${card.name}`)
      .setThumbnail(card.assets[0].fullAbsolutePath)
      .addField("Cost", `${card.cost}`, true)
      .addField("Region", `${card.region}`, true)
      .addField(
        "Keywords",
        `${card.keywords.length > 0 ? card.keywords.join("\n") : "(none)"}`,
        true
      )
      .addField(
        "Description",
        `${card.descriptionRaw.length > 0 ? card.descriptionRaw : "(none)"}`
      );
    if (card.type.toLowerCase() === "unit") {
      freshEmbed
        .addField("Attack", `${card.attack}`, true)
        .addField("Health", `${card.health}`, true);
    }
    freshEmbed.setImage(card.assets[0].gameAbsolutePath);
    embeds.push(freshEmbed);
  }
  return embeds;
}

/*
  region to emoji
*/
function region_to_emoji(region) {
  const regions = {
    "": "<:iconall:708929175045668934>",
    none: "<:iconall:708929175045668934>",
    bilgewater: "<:iconbilgewater:708929174777364572>",
    demacia: "<:icondemacia:708929174995337227>",
    freljord: "<:iconfreljord:708929175263641611>",
    ionia: "<:iconionia:708929175225892985>",
    noxus: "<:iconnoxus:708929175775608873>",
    piltoverzaun: "<:iconpiltoverzaun:708929175905632297>",
    shadowisles: "<:iconshadowisles:708929175943118919>",
  };
  return regions[region.toLowerCase()];
}

/*
  rarity to emoji

  uses a list of custom emojis to transate rarity names to icon
*/
function rarity_to_emoji(rarity) {
  const rarities = {
    common: "🟩",
    rare: "🟦",
    epic: "🟪",
    champion: "🟧",
    "": "❎",
    none: "❎",
  };
  return rarities[rarity.toLowerCase()];
}

function sort_cards(a, b, string = "") {
  if (a.name.toLowerCase() === b.name.toLowerCase()) {
    return a.cardCode > b.cardCode ? 1 : -1;
  } else if (
    a.name.toLowerCase() === string &&
    b.name.toLowerCase() !== string
  ) {
    return -1;
  } else if (b.name.toLowerCase() === string && a.name.toLowerCase !== string) {
    return 1;
  } else {
    return a.name > b.name ? 1 : -1;
  }
}

async function fetch_image(code) {
  let image = "";
  let valid = true;

  if (fs.existsSync(`${__dirname}/${code}.png`)) {
    image = `${__dirname}/${code}.png`;
  } else {
    /* enable this when testing on windows
    const browser = await puppeteer.launch({
      ignoreDefaultArgs: ["--disable-extensions"],
    });*/
    /* enable this on production */
    const browser = await puppeteer.launch({
      executablePath: "chromium-browser",
    });
    /* */
    const page = await browser.newPage();
    await page.setViewport({
      width: 1000,
      height: 2000,
      deviceScaleFactor: 1,
    });
    await page.goto(`https://decks.wizra.cc/${code}`, {
      waitUntil: "networkidle2",
    });
    const rect = await page.evaluate(() => {
      const cardArr = document.querySelectorAll(".Minicard");
      const cardCount = cardArr.length;
      const element = document.querySelector("div.cards");
      const { x, y, width, height } = element.getBoundingClientRect();
      return { left: x, top: y, width, height, cardCount };
    });
    if (rect.cardCount !== 0) {
      await page.screenshot({
        path: `${code}.png`,
        clip: {
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: 31 * rect.cardCount,
        },
      });
      image = `${__dirname}/${code}.png`;
    } else {
      valid = false;
    }
    await browser.close();
  }

  return valid ? image : false;
}

module.exports = {
  find_card,
  short_results,
  card_lookup,
  long_results,
  fetch_image,
  deck_translate,
};
