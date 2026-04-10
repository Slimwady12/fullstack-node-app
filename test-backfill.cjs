const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(process.cwd(), 'database.json');
const BACKUP_PATH = path.join(process.cwd(), 'database-backup.json');

async function testBackfill() {
  console.log('=== TESTING SCHEMA BACKFILL ===\n');
  
  // Backup current database
  const currentDb = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  fs.writeFileSync(BACKUP_PATH, JSON.stringify(currentDb, null, 2));
  console.log('✓ Database backed up\n');

  // Test 1: Remove aiChats collection
  console.log('Test 1: Remove aiChats collection');
  const test1Db = JSON.parse(JSON.stringify(currentDb));
  delete test1Db.aiChats;
  fs.writeFileSync(DB_PATH, JSON.stringify(test1Db, null, 2));
  console.log('  - Removed aiChats from database.json');
  console.log('  - Restart server to test backfill\n');

  // Test 2: Remove savedLawyers from a user
  console.log('Test 2: Remove savedLawyers from user');
  const test2Db = JSON.parse(JSON.stringify(currentDb));
  if (test2Db.users && test2Db.users.length > 0) {
    delete test2Db.users[0].savedLawyers;
    console.log('  - Removed savedLawyers from first user');
    fs.writeFileSync(DB_PATH, JSON.stringify(test2Db, null, 2));
    console.log('  - Restart server to test backfill\n');
  }

  // Test 3: Remove userId from a review
  console.log('Test 3: Remove userId from review');
  const test3Db = JSON.parse(JSON.stringify(currentDb));
  if (test3Db.lawyers && test3Db.lawyers.length > 0) {
    const lawyer = test3Db.lawyers[0];
    if (lawyer.reviews && lawyer.reviews.length > 0) {
      delete lawyer.reviews[0].userId;
      console.log('  - Removed userId from first review');
      fs.writeFileSync(DB_PATH, JSON.stringify(test3Db, null, 2));
      console.log('  - Restart server to test backfill\n');
    } else {
      console.log('  - No reviews found, skipping\n');
    }
  }

  // Test 4: Remove templateVersion from automation
  console.log('Test 4: Remove templateVersion from automation');
  const test4Db = JSON.parse(JSON.stringify(currentDb));
  if (test4Db.automations && test4Db.automations.length > 0) {
    delete test4Db.automations[0].templateVersion;
    console.log('  - Removed templateVersion from first automation');
    fs.writeFileSync(DB_PATH, JSON.stringify(test4Db, null, 2));
    console.log('  - Restart server to test backfill\n');
  } else {
    console.log('  - No automations found, skipping\n');
  }

  // Test 5: Remove templateVersion from document
  console.log('Test 5: Remove templateVersion from document');
  const test5Db = JSON.parse(JSON.stringify(currentDb));
  if (test5Db.documents && test5Db.documents.length > 0) {
    delete test5Db.documents[0].templateVersion;
    console.log('  - Removed templateVersion from first document');
    fs.writeFileSync(DB_PATH, JSON.stringify(test5Db, null, 2));
    console.log('  - Restart server to test backfill\n');
  } else {
    console.log('  - No documents found, skipping\n');
  }

  console.log('=== BACKFILL TEST SCENARIOS READY ===');
  console.log('To test each scenario:');
  console.log('1. Run the scenario above to modify database.json');
  console.log('2. Restart the server: npm run dev');
  console.log('3. Check server logs for backfill messages');
  console.log('4. Verify the missing field was restored in database.json');
  console.log('\nTo restore original database:');
  console.log('  cp database-backup.json database.json');
}

testBackfill().catch(console.error);
