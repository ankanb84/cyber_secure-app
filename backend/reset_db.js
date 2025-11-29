require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');
const Message = require('./src/models/Message');
const Group = require('./src/models/Group');
const GroupMessage = require('./src/models/GroupMessage');
const FriendRequest = require('./src/models/FriendRequest');
// Add other models if they exist, e.g. Device, File, Reaction
// Based on previous context, these seem to be the main ones.

async function resetDb() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        await User.deleteMany({});
        console.log('Deleted all Users');

        await Message.deleteMany({});
        console.log('Deleted all Messages');

        await Group.deleteMany({});
        console.log('Deleted all Groups');

        await GroupMessage.deleteMany({});
        console.log('Deleted all GroupMessages');

        await FriendRequest.deleteMany({});
        console.log('Deleted all FriendRequests');

        console.log('Database reset complete');
        process.exit(0);
    } catch (err) {
        console.error('Error resetting database:', err);
        process.exit(1);
    }
}

resetDb();
