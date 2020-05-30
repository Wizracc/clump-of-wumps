const Discord = require("discord.js");
const client = new Discord.Client();
const { token, prefix } = require("./config.json");
const {
  find_card,
  short_results,
  card_lookup,
  long_results,
  send_deck_image,
  quick_deck,
} = require("./helpers");

client.on("ready", () => {
  console.log("I am ready!");
  client.user.setActivity("for +deck CODE", { type: "WATCHING" });
});

client.on("message", async (message) => {
  // ignore bots
  if (message.author.bot) return;

  // see if message has card searches in it
  if (!message.content.startsWith(prefix)) {
    const reg = /\[.*?\]/g;
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
        replyString = "";
      } else if (successes.length === 1) {
        replyString = `Found a match for ${successes[0]}`;
      } else {
        for (success of successes) {
          replyString = replyString.concat(` ${success},`);
        }
        replyString = replyString.slice(0, -1);
        replyString = replyString.concat(".");
      }
      if (replyString !== "") message.reply(replyString);
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
\n\`${prefix}deck DECKCODE\`: -shows a simplified decklist much more quickly than deck-image`;
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
              user.id !== client.user.id &&
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
            user.id !== client.user.id &&
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
  } else if (command === "deck-image") {
    /*
    deck image
    */
    send_deck_image(args[0], message);
    return;
  } else if (command === "deck") {
    const embeds = quick_deck(args[0]);
    message.channel.send(embeds[0]);
  }
});

client.login(token);
