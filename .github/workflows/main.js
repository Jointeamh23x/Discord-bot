const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const crypto = require('crypto');

// CONFIG
const token = process.env.DISCORD_TOKEN;
const clientId = '1488888796761030726';
const guildId = '1479146429669839002';
const OWNER_ID = '1417830313211465808';

// FILES
const warnsFile = path.join(__dirname, 'warns.json');
const codesFile = path.join(__dirname, 'codes.json');
const plansFile = path.join(__dirname, 'plans.json');
const adsFile = path.join(__dirname, 'ads.json');

// LOAD
let warns = fs.existsSync(warnsFile) ? JSON.parse(fs.readFileSync(warnsFile)) : {};
let codes = fs.existsSync(codesFile) ? JSON.parse(fs.readFileSync(codesFile)) : {};
let plans = fs.existsSync(plansFile) ? JSON.parse(fs.readFileSync(plansFile)) : {};
let ads = fs.existsSync(adsFile) ? JSON.parse(fs.readFileSync(adsFile)) : {};

const badWords = ['fuck','shit','bitch','asshole','nigger'];

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// --------------------
// UTIL
// --------------------
function generateUniqueCode() {
  let code;
  do {
    code = crypto.randomBytes(6).toString('hex').toUpperCase();
    code = code.match(/.{1,4}/g).join('-');
  } while (codes[code]);
  return code;
}

function getAdLimit(plan) {
  if (plan === 'Premium') return 30;
  if (plan === 'Booster') return 10;
  return 3;
}

async function updateUserRole(member, plan) {
  const booster = member.guild.roles.cache.find(r => r.name === 'Booster Plan');
  const premium = member.guild.roles.cache.find(r => r.name === 'Premium Plan');

  if (booster) await member.roles.remove(booster).catch(()=>{});
  if (premium) await member.roles.remove(premium).catch(()=>{});

  if (plan === 'Booster' && booster) await member.roles.add(booster).catch(()=>{});
  if (plan === 'Premium' && premium) await member.roles.add(premium).catch(()=>{});
}

// --------------------
// COMMANDS
// --------------------
const commands = [
  new SlashCommandBuilder().setName('generatecode').setDescription('Generate code (owner)')
    .addStringOption(o=>o.setName('plan').setDescription('Plan').setRequired(true)
      .addChoices(
        {name:'Free',value:'Free'},
        {name:'Booster',value:'Booster'},
        {name:'Premium',value:'Premium'}
      )),

  new SlashCommandBuilder().setName('redeem').setDescription('Redeem code')
    .addStringOption(o=>o.setName('code').setDescription('Code').setRequired(true)),

  new SlashCommandBuilder().setName('plan').setDescription('Show your plan'),

  new SlashCommandBuilder().setName('removeplan').setDescription('Remove plan (owner)')
    .addUserOption(o=>o.setName('user').setDescription('User').setRequired(true)),

  new SlashCommandBuilder().setName('premiumcmd').setDescription('Premium command'),
  new SlashCommandBuilder().setName('boostercmd').setDescription('Booster command'),

  new SlashCommandBuilder().setName('postad').setDescription('Post ad')
    .addStringOption(o=>o.setName('message').setDescription('Ad message').setRequired(true)),

  new SlashCommandBuilder().setName('robloxprofile').setDescription('Roblox profile')
    .addStringOption(o=>o.setName('username').setDescription('Username').setRequired(true)),

  new SlashCommandBuilder().setName('assetinfo').setDescription('Asset info')
    .addIntegerOption(o=>o.setName('assetid').setDescription('Asset ID').setRequired(true))
].map(c=>c.toJSON());

const rest = new REST({version:'10'}).setToken(token);
(async()=>{await rest.put(Routes.applicationGuildCommands(clientId,guildId),{body:commands});})();

// --------------------
// READY
// --------------------
client.once('ready',()=>console.log('Bot online'));

// --------------------
// WARN SYSTEM
// --------------------
client.on('messageCreate',async msg=>{
  if(msg.author.bot)return;
  const text=msg.content.toLowerCase();

  if(badWords.some(w=>text.includes(w))){
    if(msg.deletable) await msg.delete();

    const id=msg.author.id;
    if(!warns[id]) warns[id]=0;
    warns[id]++;

    fs.writeFileSync(warnsFile,JSON.stringify(warns,null,2));

    msg.channel.send(`${msg.author} warned (${warns[id]})`);

    if(warns[id]===3 && msg.member.kickable) await msg.member.kick();
    if(warns[id]>=5 && msg.member.bannable){ await msg.member.ban(); warns[id]=0; }
  }
});

// --------------------
// COMMAND HANDLER
// --------------------
client.on('interactionCreate',async i=>{
  if(!i.isChatInputCommand())return;
  const cmd=i.commandName;

  // GENERATE CODE
  if(cmd==='generatecode'){
    if(i.user.id!==OWNER_ID) return i.reply({content:'Owner only',ephemeral:true});
    const plan=i.options.getString('plan');
    const code=generateUniqueCode();

    codes[code]={plan,used:false};
    fs.writeFileSync(codesFile,JSON.stringify(codes,null,2));

    i.reply(`Code: ${code}`);
  }

  // REDEEM
  if(cmd==='redeem'){
    const code=i.options.getString('code');
    if(!codes[code]) return i.reply('Invalid code');
    if(codes[code].used) return i.reply('Alreaddy Used');

    const plan=codes[code].plan;
    plans[i.user.id]=plan;
    codes[code].used=true;

    fs.writeFileSync(codesFile,JSON.stringify(codes,null,2));
    fs.writeFileSync(plansFile,JSON.stringify(plans,null,2));

    const member=await i.guild.members.fetch(i.user.id);
    updateUserRole(member,plan);

    i.reply(`You got ${plan}`);
  }

  // PLAN
  if(cmd==='plan'){
    i.reply(`Plan: ${plans[i.user.id]||'Free'}`);
  }

  // REMOVE PLAN
  if(cmd==='removeplan'){
    if(i.user.id!==OWNER_ID) return i.reply('Owner only');
    const target=i.options.getMember('user');

    delete plans[target.id];
    fs.writeFileSync(plansFile,JSON.stringify(plans,null,2));
    updateUserRole(target,'None');

    i.reply('Removed');
  }

  // PREMIUM CMD
  if(cmd==='premiumcmd'){
    if(plans[i.user.id]!=='Premium') return i.reply({content:'Premium only',ephemeral:true});
    i.reply('🔥 Premium command used');
  }

  // BOOSTER CMD
  if(cmd==='boostercmd'){
    const p=plans[i.user.id];
    if(p!=='Booster'&&p!=='Premium') return i.reply({content:'Booster only',ephemeral:true});
    i.reply('⚡ Booster command used');
  }

  // POST AD
  if(cmd==='postad'){
    const user=i.user.id;
    const plan=plans[user]||'Free';
    const msg=i.options.getString('message');

    const now=new Date();
    const month=`${now.getFullYear()}-${now.getMonth()}`;

    if(!ads[user]) ads[user]={};
    if(!ads[user][month]) ads[user][month]=0;

    const limit=getAdLimit(plan);
    if(ads[user][month]>=limit) return i.reply({content:'Limit reached',ephemeral:true});

    const ch=i.guild.channels.cache.find(c=>c.name==='🗒️-general-ads');
    if(!ch) return i.reply('No ads channel');

    ads[user][month]++;
    fs.writeFileSync(adsFile,JSON.stringify(ads,null,2));

    ch.send(`📢 ${i.user.tag}\n${msg}`);
    i.reply({content:`Posted (${ads[user][month]}/${limit})`,ephemeral:true});
  }

  // ROBLOX
  if(cmd==='robloxprofile'){
    const u=i.options.getString('username');
    const r=await fetch(`https://api.roblox.com/users/get-by-username?username=${u}`);
    const d=await r.json();
    i.reply(`User: ${d.Username}`);
  }

  if(cmd==='assetinfo'){
    const id=i.options.getInteger('assetid');
    const r=await fetch(`https://api.roblox.com/marketplace/productinfo?assetId=${id}`);
    const d=await r.json();
    i.reply(`Asset: ${d.Name}`);
  }

});

client.login(token);