import { GarminConnect } from 'garmin-connect';
import { prisma } from '../packages/db/src/client';

function decrypt(ciphertext: string): string {
  const { createDecipheriv } = require('crypto') as typeof import('crypto');
  const keyHex = process.env.ENCRYPTION_KEY!;
  const key = Buffer.from(keyHex, 'hex');
  const parts = ciphertext.split(':');
  const [ivHex, tagHex, encHex] = parts as [string, string, string];
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return decipher.update(Buffer.from(encHex, 'hex')).toString('utf8') + decipher.final('utf8');
}

const sleep2s = () => new Promise(r => setTimeout(r, 2000));

async function test() {
  const user = await prisma.user.findFirst({
    where: { garminEmail: { not: null } },
    select: { garminEmail: true, garminPassword: true },
  });

  const password = decrypt(user!.garminPassword!);
  const gc = new GarminConnect({ username: user!.garminEmail!, password });
  await gc.login(user!.garminEmail!, password);
  console.log('✅ Login OK');

  const yesterdayStr = new Date(Date.now() - 86400_000).toISOString().split('T')[0]!;
  const profile = await (gc as any).getUserProfile();
  const displayName = profile?.displayName;
  console.log('displayName:', displayName);

  // Full daily summary
  console.log('\n=== FULL Daily Summary ===');
  try {
    const summary = await (gc as any).get(
      `https://connectapi.garmin.com/usersummary-service/usersummary/daily/${displayName}?calendarDate=${yesterdayStr}`
    );
    console.log(JSON.stringify(summary, null, 2));
  } catch (e: any) { console.log('❌', e.message); }
  await sleep2s();

  // Try body battery alternatives
  console.log('\n=== Body Battery alternatives ===');
  const bbUrls = [
    `https://connectapi.garmin.com/wellness-service/wellness/bodyBattery/range/${yesterdayStr}/${yesterdayStr}`,
    `https://connectapi.garmin.com/usersummary-service/usersummary/hydration/daily/${yesterdayStr}`,
    `https://connectapi.garmin.com/usersummary-service/usersummary/wellnessData?calendarDate=${yesterdayStr}`,
  ];
  for (const url of bbUrls) {
    try {
      const data = await (gc as any).get(url);
      console.log(`✅ ${url}:`, JSON.stringify(data).substring(0, 500));
    } catch (e: any) { console.log(`❌ ${url}: ${e.message.substring(0, 100)}`); }
    await sleep2s();
  }

  // Training readiness alternatives
  console.log('\n=== Training Readiness alternatives ===');
  const trUrls = [
    `https://connectapi.garmin.com/metrics-service/metrics/trainingReadiness?startDate=${yesterdayStr}&endDate=${yesterdayStr}`,
    `https://connectapi.garmin.com/wellness-service/wellness/trainingReadiness/${yesterdayStr}`,
    `https://connectapi.garmin.com/fitnessstats-service/fitnessstats?startDate=${yesterdayStr}&endDate=${yesterdayStr}&metricId=60`,
  ];
  for (const url of trUrls) {
    try {
      const data = await (gc as any).get(url);
      console.log(`✅ ${url}:`, JSON.stringify(data).substring(0, 500));
    } catch (e: any) { console.log(`❌ ${url}: ${e.message.substring(0, 100)}`); }
    await sleep2s();
  }

  await prisma.$disconnect();
}

test().catch(console.error).finally(() => process.exit());
