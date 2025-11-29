require('dotenv').config();
const mongoose = require('mongoose');
const Group = require('./src/models/Group');

async function checkGroups() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const groups = await Group.find({});
        console.log('Groups in DB:');
        groups.forEach(g => {
            console.log(`- Name: ${g.name}, ID: ${g._id}, Creator: ${g.creatorId}`);
        });

        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

checkGroups();
