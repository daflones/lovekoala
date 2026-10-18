import test from 'node:test';
import assert from 'node:assert/strict';
import {relationshipClock} from '../src/features.mjs';
import {giftEditable,hasGiftAccess,PLANS,accessLabel} from '../src/domain.mjs';
test('relógio faz a virada de segundos, minutos, horas e dias no instante de Brasília',()=>{
 const before=relationshipClock('2026-10-15','13:00',new Date('2026-10-16T15:59:59Z'));
 assert.equal(before.days,0);assert.equal(before.hoursPart,23);assert.equal(before.minutesPart,59);assert.equal(before.secondsPart,59);assert.equal(before.totalSeconds,86399);
 const after=relationshipClock('2026-10-15','13:00',new Date('2026-10-16T16:00:00Z'));
 assert.equal(after.days,1);assert.equal(after.hoursPart,0);assert.equal(after.minutesPart,0);assert.equal(after.secondsPart,0);assert.equal(after.totalMinutes,1440);
 assert.equal(relationshipClock('2026-10-16','',new Date('2026-10-16T03:00:05Z')).totalSeconds,5);
 assert.equal(relationshipClock('2026-02-30','12:00'),null);assert.equal(relationshipClock('2026-10-16','24:00'),null);assert.equal(relationshipClock('2026-10-16','17:00',new Date('2026-10-16T16:00:00Z')),null);
});
test('24h encerra edição no instante exato e vitalício aceita infinity somente no tipo correto',()=>{
 const now=Date.parse('2026-10-16T16:00:00Z');const gift={access_kind:'24h',edit_expires_at:'2026-10-16T16:00:00Z',expires_at:'2026-10-16T16:00:00Z',status:'published'};
 assert.equal(giftEditable(gift,now-1),true);assert.equal(giftEditable(gift,now),false);assert.equal(hasGiftAccess(gift,now),false);
 for(const kind of ['lifetime','club']){assert.equal(hasGiftAccess({...gift,access_kind:kind,edit_expires_at:null,expires_at:'infinity'},now),true);}
 assert.equal(hasGiftAccess({...gift,access_kind:'legacy',expires_at:'infinity'},now),false);
 assert(accessLabel(PLANS[0]).includes('24 horas'));assert(accessLabel(PLANS[1]).includes('vitalício'));assert(accessLabel(PLANS[2]).includes('2 presentes'));
});
