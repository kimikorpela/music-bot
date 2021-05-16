//This is a bot for playing music in Discord. 
//It answers in Finnish but all the comments are in English so feel free to change the language in the code on your own.

//Importing needed dependencies
const Discord = require("discord.js");
const { prefix, token } = require("./config.json");
const ytdl = require("ytdl-core");

//Creating a client
const client = new Discord.Client();

//Creating a Map for the song queue
const queue = new Map();

//Creating couple listeners that console log when executed
client.once("ready", () => {
    console.log("Ready!");
});

client.once("reconnecting", () => {
    console.log("Reconnecting!");
});

client.once("disconnect", () => {
    console.log("Disconnect!");
});

//Creating a function for reading discord chat messages
client.on("message", async message => {
    if (message.author.bot) return;  //Checking if the message is from this bot and ignoring the message if so
    if (!message.content.startsWith(prefix)) return; //Checking if the message starts with the prefix(!)

    const serverQueue = queue.get(message.guild.id); 

    //Checking which command is used after the prefix and if not valid sending a message "You need to enter a valid command!"
    if (message.content.startsWith(`${prefix}play`)) {
        execute(message, serverQueue);
        return;
    } else if (message.content.startsWith(`${prefix}skip`)) {
        skip(message, serverQueue);
        return;
    } else if (message.content.startsWith(`${prefix}stop`)) {
        stop(message, serverQueue);
        return;
    } else {
        message.channel.send("Sun pitää antaa joku toimivista komennoista: !play, !skip tai !stop!");
    }
});

//Creating a function to check that the user is in voice chat and that bot has permission to join the channel
async function execute(message, serverQueue) {
    const args = message.content.split(" ");

    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel)
        return message.channel.send(
            "Sun pitää olla voicekanavalla voidakses laittaa musaa!"
        );
    const permissions = voiceChannel.permissionsFor(message.client.user);
    if (!permissions.has("CONNECT") || !permissions.has("SPEAK")) {
        return message.channel.send(
            "Tarviin luvat liittyä ja puhua tällä voicekanavalla!"
        );
    }

//Getting the song info using the ytdl library and saving it to a object
    const songInfo = await ytdl.getInfo(args[1]);
    const song = {
        title: songInfo.videoDetails.title,
        url: songInfo.videoDetails.video_url,
    };

//Creating a contract that can be added to the song queue and checking if a song is already playing(if yes the song is added to the queue)
    if (!serverQueue) {
        const queueContract = {
            textChannel: message.channel,
            voiceChannel: voiceChannel,
            connection: null,
            songs: [],
            volume: 4,
            playing: true
        };

        queue.set(message.guild.id, queueContract);

        queueContract.songs.push(song);

        try {
            var connection = await voiceChannel.join();
            queueContract.connection = connection;
            play(message.guild, queueContract.songs[0]);
        } catch (err) {
            console.log(err);
            queue.delete(message.guild.id);
            return message.channel.send(err);
        }
    } else {
        serverQueue.songs.push(song);
        return message.channel.send(`${song.title} on lisätty jonoon!`);
    }
}

//Function for skipping a song by using the !skip command
function skip(message, serverQueue) {
    if (!message.member.voice.channel)
        return message.channel.send(
            "Sun pitää olla voicekanavalla voidakses skipata musaa!"
        );
    if (!serverQueue)
        return message.channel.send("Ei oo mitään biisiä mihin voisin skipata! Voit lisätä biisejä !play komennolla!");
    serverQueue.connection.dispatcher.end();
}

//Function for stopping the song the bot is playing using the !stop command
function stop(message, serverQueue) {
    if (!message.member.voice.channel)
        return message.channel.send(
            "Sun pitää olla voicekanavalla voidakses lopettaa musan!"
        );

    if (!serverQueue)
        return message.channel.send("Ei oo mitään biisiä minkä voisin lopettaa! Voit lisätä biisejä !play komennolla!");

    serverQueue.songs = [];
    serverQueue.connection.dispatcher.end();
}

//Function for playing a song or adding a song to the queue using the !play command
function play(guild, song) {
    const serverQueue = queue.get(guild.id);
    if (!song) {
        serverQueue.voiceChannel.leave();
        queue.delete(guild.id);
        return;
    }

    const dispatcher = serverQueue.connection
        .play(ytdl(song.url))
        .on("finish", () => {
            serverQueue.songs.shift();
            play(guild, serverQueue.songs[0]);
        })
        .on("error", error => console.error(error));
    dispatcher.setVolumeLogarithmic(serverQueue.volume / 4);
    serverQueue.textChannel.send(`Nyt soi: **${song.title}**`);
}
//Logging in using the bot token
client.login(token);
