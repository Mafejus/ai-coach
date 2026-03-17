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
  console.log('✅ Login OK\n');

  // Get last activity
  const activities = await (gc as any).getActivities(0, 3);
  const activity = activities[0];
  const activityId = activity.activityId;
  console.log('Latest activity:', activityId, activity.activityName, activity.startTimeLocal);
  console.log('Activity summary keys:', Object.keys(activity).join(', '));
  console.log();
  await sleep2s();

  // 1. Full activity detail
  console.log('=== gc.getActivity() ===');
  try {
    const detail = await (gc as any).getActivity({ activityId });
    console.log('Keys:', Object.keys(detail).join(', '));
    console.log(JSON.stringify(detail, null, 2).substring(0, 3000));
  } catch (e: any) { console.log('❌', e.message); }
  await sleep2s();

  // 2. Activity details with streams (the key endpoint)
  console.log('\n=== /activity-service/activity/{id}/details ===');
  try {
    const details = await (gc as any).get(
      `https://connectapi.garmin.com/activity-service/activity/${activityId}/details?maxChartSize=100&maxPolylineSize=500`
    );
    const keys = Object.keys(details);
    console.log('Keys:', keys.join(', '));
    if (details.geoPolylineDTO) {
      console.log('GPS polyline present! Points:', details.geoPolylineDTO.polyline?.length);
      console.log('First GPS point:', JSON.stringify(details.geoPolylineDTO.polyline?.[0]));
    }
    if (details.activityDetailMetrics) {
      console.log('Detail metrics count:', details.activityDetailMetrics.length);
      console.log('First metric sample:', JSON.stringify(details.activityDetailMetrics[0]));
    }
    if (details.metricDescriptors) {
      console.log('Metric descriptors:', JSON.stringify(details.metricDescriptors));
    }
    console.log('\nFull response (first 3000 chars):');
    console.log(JSON.stringify(details, null, 2).substring(0, 3000));
  } catch (e: any) { console.log('❌', e.message); }
  await sleep2s();

  // 3. Splits/laps
  console.log('\n=== /activity-service/activity/{id}/splits ===');
  try {
    const splits = await (gc as any).get(
      `https://connectapi.garmin.com/activity-service/activity/${activityId}/splits`
    );
    console.log('Splits keys:', Object.keys(splits).join(', '));
    console.log('Lap count:', splits.lapDTOs?.length);
    if (splits.lapDTOs?.[0]) {
      console.log('First lap keys:', Object.keys(splits.lapDTOs[0]).join(', '));
      console.log('First lap:', JSON.stringify(splits.lapDTOs[0]));
    }
  } catch (e: any) { console.log('❌', e.message); }
  await sleep2s();

  // 4. GPS track
  console.log('\n=== GPS track endpoint ===');
  try {
    const gps = await (gc as any).get(
      `https://connectapi.garmin.com/activity-service/activity/${activityId}/details`
    );
    if (gps.geoPolylineDTO?.polyline) {
      console.log('✅ GPS polyline found!');
      console.log('Total GPS points:', gps.geoPolylineDTO.polyline.length);
      console.log('Sample point:', JSON.stringify(gps.geoPolylineDTO.polyline[0]));
    } else {
      console.log('No GPS polyline in response');
      console.log('Keys:', Object.keys(gps).join(', '));
    }
  } catch (e: any) { console.log('❌', e.message); }

  await prisma.$disconnect();
}

test().catch(console.error).finally(() => process.exit());
