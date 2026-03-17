import { GarminConnect } from 'garmin-connect';
import { prisma } from '../packages/db/src/client';

// Inline decrypt to avoid app-specific import issues
function decrypt(ciphertext: string): string {
  const { createDecipheriv } = require('crypto') as typeof import('crypto');
  const keyHex = process.env.ENCRYPTION_KEY!;
  const key = Buffer.from(keyHex, 'hex');
  const parts = ciphertext.split(':');
  if (parts.length !== 3) throw new Error('Invalid ciphertext format');
  const [ivHex, tagHex, encHex] = parts as [string, string, string];
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return decipher.update(Buffer.from(encHex, 'hex')).toString('utf8') + decipher.final('utf8');
}

async function test() {
  const user = await prisma.user.findFirst({
    where: { garminEmail: { not: null } },
    select: { id: true, garminEmail: true, garminPassword: true },
  });

  if (!user?.garminEmail || !user.garminPassword) {
    console.error('❌ No Garmin credentials in DB');
    await prisma.$disconnect();
    return;
  }

  const password = decrypt(user.garminPassword);
  console.log('Logging in as:', user.garminEmail);

  const gc = new GarminConnect({ username: user.garminEmail, password });
  await gc.login(user.garminEmail, password);
  console.log('✅ Login successful');

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0]!;
  console.log('Testing date:', yesterdayStr);

  // Test all available methods
  const sleep2s = () => new Promise(r => setTimeout(r, 2000));

  // 1. getSleepData
  console.log('\n--- getSleepData ---');
  try {
    const data = await (gc as any).getSleepData(new Date(yesterdayStr));
    console.log('✅ getSleepData:', JSON.stringify(data, null, 2).substring(0, 2000));
  } catch (e: any) {
    console.log('❌ getSleepData error:', e.message);
  }
  await sleep2s();

  // 2. getHeartRate
  console.log('\n--- getHeartRate ---');
  try {
    const data = await (gc as any).getHeartRate(new Date(yesterdayStr));
    console.log('✅ getHeartRate:', JSON.stringify(data, null, 2).substring(0, 1000));
  } catch (e: any) {
    console.log('❌ getHeartRate error:', e.message);
  }
  await sleep2s();

  // 3. Try HRV via raw API
  console.log('\n--- HRV via raw GET ---');
  try {
    const profile = await (gc as any).getUserProfile();
    const displayName = profile?.displayName;
    console.log('displayName:', displayName);

    if (displayName) {
      const hrv = await (gc as any).get(
        `https://connectapi.garmin.com/hrv-service/hrv/${yesterdayStr}`
      );
      console.log('✅ HRV raw:', JSON.stringify(hrv, null, 2).substring(0, 1000));
    }
  } catch (e: any) {
    console.log('❌ HRV error:', e.message);
  }
  await sleep2s();

  // 4. Try user daily summary via raw API
  console.log('\n--- User Daily Summary via raw GET ---');
  try {
    const profile = await (gc as any).getUserProfile();
    const displayName = profile?.displayName;
    if (displayName) {
      const summary = await (gc as any).get(
        `https://connectapi.garmin.com/usersummary-service/usersummary/daily/${displayName}?calendarDate=${yesterdayStr}`
      );
      console.log('✅ Daily Summary:', JSON.stringify(summary, null, 2).substring(0, 2000));
    }
  } catch (e: any) {
    console.log('❌ Daily Summary error:', e.message);
  }
  await sleep2s();

  // 5. Try body battery via raw API
  console.log('\n--- Body Battery via raw GET ---');
  try {
    const bb = await (gc as any).get(
      `https://connectapi.garmin.com/wellness-service/wellness/bodyBattery/events?startDate=${yesterdayStr}&endDate=${yesterdayStr}`
    );
    console.log('✅ Body Battery:', JSON.stringify(bb, null, 2).substring(0, 1000));
  } catch (e: any) {
    console.log('❌ Body Battery error:', e.message);
  }
  await sleep2s();

  // 6. Try training readiness via raw API
  console.log('\n--- Training Readiness via raw GET ---');
  try {
    const tr = await (gc as any).get(
      `https://connectapi.garmin.com/metrics-service/metrics/trainingReadiness/${yesterdayStr}`
    );
    console.log('✅ Training Readiness:', JSON.stringify(tr, null, 2).substring(0, 1000));
  } catch (e: any) {
    console.log('❌ Training Readiness error:', e.message);
  }
  await sleep2s();

  // 7. Try stress data
  console.log('\n--- Stress Data via raw GET ---');
  try {
    const stress = await (gc as any).get(
      `https://connectapi.garmin.com/wellness-service/wellness/dailyStress/${yesterdayStr}`
    );
    console.log('✅ Stress:', JSON.stringify(stress, null, 2).substring(0, 1000));
  } catch (e: any) {
    console.log('❌ Stress error:', e.message);
  }
  await sleep2s();

  // 8. getSleepDuration
  console.log('\n--- getSleepDuration ---');
  try {
    const data = await (gc as any).getSleepDuration(new Date(yesterdayStr));
    console.log('✅ getSleepDuration:', JSON.stringify(data, null, 2).substring(0, 500));
  } catch (e: any) {
    console.log('❌ getSleepDuration error:', e.message);
  }

  await prisma.$disconnect();
}

test().catch(console.error).finally(() => process.exit());
