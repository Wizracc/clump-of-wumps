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
  try {
    const rawDeck = DeckEncoder.decode(code);
    var deck = {
      regions: {
        bilgewater: [],
        demacia: [],
        freljord: [],
        ionia: [],
        noxus: [],
        piltoverzaun: [],
        shadowisles: [],
      },
      types: {
        champion: [],
        unit: [],
        spell: [],
      },
    };
    for (const card of rawDeck) {
      const raw = { ...data.find((o) => o.cardCode === card.code) };
      const cardInfo = {
        region: raw.regionRef.toLowerCase(),
        name: raw.name,
        cost: raw.cost,
        count: card.count,
        code: raw.cardCode,
        type: raw.supertype === "Champion" ? "Champion" : raw.type,
        rarity: raw.rarity.toLowerCase(),
      };
      deck.regions[cardInfo.region.toLowerCase()].push(cardInfo);
      deck.types[cardInfo.type.toLowerCase()].push(cardInfo);
    }
    return deck;
  } catch (error) {
    console.error(error);
    return null;
  }
}

function quick_deck(code) {
  const data = quick_deck_data(code);
  if (data !== null) {
    var embeds = [];
    var regionEmbed = new Discord.MessageEmbed()
      .setTitle(data[0].title)
      .setFooter(
        `To generate an image of this decklist, use the ${prefix}deck-image command`
      );
    for (region of data[0].regions) {
      var regionName = regionRef_to_regionName(region.name);
      var emoji = region_to_emoji(region.name);
      regionEmbed.addField(`${emoji} **${regionName}**`, region.cards, true);
    }
    embeds.push(regionEmbed);
    var typeEmbed = new Discord.MessageEmbed()
      .setTitle(data[1].title)
      .setFooter(
        `To generate an image of this decklist, use the ${prefix}deck-image command`
      );
    for (type in data[1].types) {
      typeEmbed.addField(type, data[1].types[type], true);
    }
    embeds.push(typeEmbed);
    return embeds;
  } else {
    return null;
  }
}

function quick_deck_data(code) {
  const deck = deck_translate(code);
  if (deck !== null) {
    var embed1_data = {
      title: "",
      regions: [],
    };
    var embed2_data = {
      title: "",
      types: {
        champion: "",
        unit: "",
        spell: "",
      },
    };
    var title = "";

    var index = 0;

    for (region in deck.regions) {
      if (deck.regions[region].length > 0) {
        embed1_data.regions.push({ name: region, cards: "" });
        for (card of deck.regions[region]) {
          embed1_data.regions[index].cards = embed1_data.regions[
            index
          ].cards.concat(
            `\n${rarity_to_emoji(card.rarity)} **${card.count}** ${card.name}`
          );
        }
        index++;
      }
    }

    for (type in deck.types) {
      if (deck.types[type].length > 0) {
        for (card of deck.types[type]) {
          embed2_data.types[type] = embed2_data.types[type].concat(
            `\n**${card.count}** ${card.name}`
          );
        }
      } else {
        delete deck.types[type];
      }
    }

    if (embed2_data.types.champion.length > 0) {
      for (champ of deck.types.champion) {
        title = title.concat(champ.name + " & ");
      }
    } else {
      for (region of embed1_data.regions) {
        var regionName = regionRef_to_regionName(region.name);
        title = title.concat(regionName + " & ");
      }
    }
    embed1_data.title = title.slice(0, -3);
    embed2_data.title = title.slice(0, -3);

    return [embed1_data, embed2_data];
  } else {
    return null;
  }
}

function regionRef_to_regionName(regionRef) {
  const obj = {
    bilgewater: "Bilgewater",
    demacia: "Demacia",
    freljord: "Freljord",
    ionia: "Ionia",
    noxus: "Noxus",
    piltoverzaun: "Piltover & Zaun",
    shadowisles: "Shadow Isles",
    none: "<no region>",
  };
  return obj[regionRef.toLowerCase()];
}

function send_deck_image(code, message) {
  message.channel.send("Fetching deck image...");
  fetch_image(code).then((image) => {
    if (image) {
      var link = `https://decks.wizra.cc/${code}`;
      const embed = new Discord.MessageEmbed()
        .setTitle("decks.wizra.cc")
        .setURL(link)
        .attachFiles([image])
        .setImage(`attachment://${code}.png`);
      message.channel.send(embed);
    } else {
      message.channel.send("Not a valid deck code");
    }
  });
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
    });
    /* */
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
  send_deck_image,
  quick_deck,
};
