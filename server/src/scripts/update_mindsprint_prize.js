const path = require('path');
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    const res = await mongoose.connection.collection('events').updateOne(
      { title: /MindSprint/i },
      { $set: { prizeMoney: 500, firstPrize: 300, secondPrize: 150, thirdPrize: 50 } }
    );
    console.log('Update matched:', res.matchedCount, 'modified:', res.modifiedCount);
    const updated = await mongoose.connection.collection('events').findOne({ title: /MindSprint/i });
    console.log('Updated Event:', updated.title);
    console.log('Total Prize Pool:', updated.prizeMoney);
    console.log('1st Prize:', updated.firstPrize);
    console.log('2nd Prize:', updated.secondPrize);
    console.log('3rd Prize:', updated.thirdPrize);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
})();
