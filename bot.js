const Discord = require("discord.js");
const client = new Discord.Client();
const { token, prefix } = require("./config.json");
const fs = require("fs");
const puppeteer = require("puppeteer");

let raw_data_set1 = fs.readFileSync(
  "./set1-lite-en_us/en_us/data/set1-en_us.json"
);
let raw_data_set2 = fs.readFileSync(
  "./set2-lite-en_us/en_us/data/set2-en_us.json"
);
const data1 = JSON.parse(raw_data_set1);
const data2 = JSON.parse(raw_data_set2);
const data = data1.concat(data2);

client.on("ready", () => {
  console.log("I am ready!");
  client.user.setActivity("for +deck CODE", { type: "WATCHING" });
});

client.on("message", async (message) => {
  // ignore bots
  if (message.author.bot) return;

  // see if message has card searches in it
  if (!message.content.startsWith(prefix)) {
    const reg = /\{.*?\}/g;
    const found = message.content.match(reg);
    if (found !== null) {
      var results = [];
      var successes = [];
      for (var string of found) {
        const str = string.slice(1, -1);
        const cards = find_card([str]);
        if (cards.length > 0) {
          const embeds = short_results(cards);
          results.push(embeds);
          successes.push(str);
        }
      }
      var replyString = `Found ${successes.length} sets of card matches for`;
      if (successes.length < 1) {
        replyString = replyString.concat(" your queries.");
      } else {
        for (success of successes) {
          replyString = replyString.concat(` ${success},`);
        }
        replyString = replyString.slice(0, -1);
        replyString = replyString.concat(".");
      }
      message.reply(replyString);
      for (result of results) {
        var index = 0;
        await message.channel.send(result[index]);
        if (result.length > 1) {
          await message.channel.send(
            "For associated cards, use +card *card name*"
          );
        }
      }
    }
    return;
  }

  const args = message.content.slice(prefix.length).split(" ");
  const command = args.shift().toLowerCase();

  /*
  fetch-commands
  */
  if (command === "commands") {
    let response_string = `The commands are as follows:
\n\`[card name]\`: -(Usable in any part of a message, multiple times), shows the matching cards, if any
\n\`${prefix}card-lookup overwhelm\`: -looks for basic string matches in titles or card text or keywords (multiple keywords must be in the same order as on the card)
\n\`${prefix}card Draven\`: -shows the exact card, use reactions to view associated cards
\n\`${prefix}deck-image DECKCODE\`: -shows an image of the deck, using https://decks.wizra.cc
\n\`${prefix}deck DECKCODE\`: -shows a simplified decklist of the cards, sorted by region then cost then name (WIP: currently same as deck-image)`;
    return message.channel.send(response_string);
  } else if (command === "card-lookup" || command === "card-search") {
    /*
    card-lookup
    */
    var cards = card_lookup(args);
    if (cards.length < 1) {
      message.channel.send("No results, please try another search");
    } else {
      var embeds = long_results(cards);
      if (embeds.length > 100) {
        message.channel.send(
          "Too many results, please use a longer search phrase."
        );
      } else {
        var index = 0;
        const thisMessage = await message.channel.send(embeds[index]);
        if (embeds.length > 1) {
          await thisMessage.react("◀️");
          await thisMessage.react("▶️");
          const filter = (reaction, user) => {
            return (
              user.id === message.author.id &&
              (reaction.emoji.name === "▶️" || reaction.emoji.name === "◀️")
            );
          };
          const collector = thisMessage.createReactionCollector(filter, {
            time: 600000,
          });
          collector.on("collect", (reaction, user) => {
            if (reaction.emoji.name === "▶️") {
              if (index < embeds.length - 1) {
                index++;
                thisMessage.edit(embeds[index]);
              }
            } else if (reaction.emoji.name === "◀️") {
              if (index > 0) {
                index--;
                thisMessage.edit(embeds[index]);
              }
            }
          });
        }
      }
    }
    return;
  } else if (command === "card" || command === "find-card") {
    /*
    find-card
    */
    var cards = find_card(args);
    if (cards.length < 1) {
      message.channel.send("No results, plese try another card");
    } else {
      var embeds = short_results(cards);
      var replyMessage = "";
      if (embeds.length > 1) {
        replyMessage = `There are ${embeds.length} associated cards with \
this search, use the ◀️▶️ buttons to navigate through the results after \
the buttons appear. Click again to "reset" the button.`;
      } else {
        replyMessage = "There is only one card with this name.";
      }
      await message.channel.send(replyMessage);
      var index = 0;
      const thisMessage = await message.channel.send(embeds[index]);
      if (embeds.length > 1) {
        await thisMessage.react("◀️");
        await thisMessage.react("▶️");
        const filter = (reaction, user) => {
          return (
            user.id === message.author.id &&
            (reaction.emoji.name === "▶️" || reaction.emoji.name === "◀️")
          );
        };
        const collector = thisMessage.createReactionCollector(filter, {
          time: 600000,
        });
        collector.on("collect", (reaction, user) => {
          if (reaction.emoji.name === "▶️") {
            if (index < embeds.length - 1) {
              index++;
              thisMessage.edit(embeds[index]);
            }
          } else if (reaction.emoji.name === "◀️") {
            if (index > 0) {
              index--;
              thisMessage.edit(embeds[index]);
            }
          }
        });
      }
    }
    return;
  } else if (command === "deck-image" || command === "deck") {
    /*
    deck image
    */
    message.channel.send("Fetching deck image...");
    fetchImage(args[0]).then((image) => {
      if (image) {
        var link = `https://decks.wizra.cc/${args[0]}`;
        const embed = new Discord.MessageEmbed()
          .setTitle("decks.wizra.cc")
          .setURL(link)
          .attachFiles([image])
          .setImage(`attachment://${args[0]}.png`);
        message.channel.send(embed);
      } else {
        message.channel.send("Not a valid deck code");
      }
    });
    return;
  }
});

client.login(token);

function deck_translate(code) {}

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

async function fetchImage(code) {
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
