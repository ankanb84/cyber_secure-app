require('dotenv').config();
const mongoose = require('mongoose');
const Group = require('./src/models/Group');
const User = require('./src/models/User');

async function debugGroupMembers() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const groups = await Group.find({});
        console.log(`Found ${groups.length} groups.`);

        for (const g of groups) {
            console.log(`\nGroup: ${g.name} (${g._id})`);
            console.log(`Creator: ${g.creatorId}`);
            console.log('Members:');
            g.members.forEach(m => {
                console.log(` - UserID: ${m.userId} (Role: ${m.role})`);
            });

            // Check if creator is in members
            const creatorInMembers = g.members.some(m => m.userId.toString() === g.creatorId.toString());
            console.log(`Creator in members list? ${creatorInMembers ? 'YES' : 'NO'}`);
        }

        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

debugGroupMembers();
