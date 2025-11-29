require('dotenv').config();
const mongoose = require('mongoose');
const Group = require('./src/models/Group');
const User = require('./src/models/User');

async function debugDb() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const users = await User.find({});
        console.log('Users:', users.map(u => ({ _id: u._id.toString(), username: u.username })));

        const groups = await Group.find({});
        console.log('Groups:', JSON.stringify(groups, null, 2));

        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

debugDb();
