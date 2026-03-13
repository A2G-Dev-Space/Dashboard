/**
 * Holiday Seed Service
 *
 * 서버 시작 시 2026년 공휴일을 자동으로 DB에 시드합니다.
 * 이미 등록된 날짜는 건너뜁니다 (멱등성 보장).
 */

import { PrismaClient } from '@prisma/client';

interface HolidaySeed {
  date: string; // YYYY-MM-DD
  name: string;
  type: 'NATIONAL' | 'COMPANY' | 'CUSTOM';
}

// 2026년 대한민국 공휴일 (대체공휴일 포함, 총 19일)
// 출처: 우주항공청 2026년 월력요항
const HOLIDAYS_2026: HolidaySeed[] = [
  { date: '2026-01-01', name: '신정', type: 'NATIONAL' },
  { date: '2026-02-16', name: '설날 연휴', type: 'NATIONAL' },
  { date: '2026-02-17', name: '설날', type: 'NATIONAL' },
  { date: '2026-02-18', name: '설날 연휴', type: 'NATIONAL' },
  { date: '2026-03-01', name: '삼일절', type: 'NATIONAL' },
  { date: '2026-03-02', name: '대체공휴일(삼일절)', type: 'NATIONAL' },
  { date: '2026-05-05', name: '어린이날', type: 'NATIONAL' },
  { date: '2026-05-24', name: '부처님오신날', type: 'NATIONAL' },
  { date: '2026-05-25', name: '대체공휴일(부처님오신날)', type: 'NATIONAL' },
  { date: '2026-06-06', name: '현충일', type: 'NATIONAL' },
  { date: '2026-08-15', name: '광복절', type: 'NATIONAL' },
  { date: '2026-08-17', name: '대체공휴일(광복절)', type: 'NATIONAL' },
  { date: '2026-09-24', name: '추석 연휴', type: 'NATIONAL' },
  { date: '2026-09-25', name: '추석', type: 'NATIONAL' },
  { date: '2026-09-26', name: '추석 연휴', type: 'NATIONAL' },
  { date: '2026-10-03', name: '개천절', type: 'NATIONAL' },
  { date: '2026-10-05', name: '대체공휴일(개천절)', type: 'NATIONAL' },
  { date: '2026-10-09', name: '한글날', type: 'NATIONAL' },
  { date: '2026-12-25', name: '크리스마스', type: 'NATIONAL' },
];

export async function seedHolidays(prisma: PrismaClient): Promise<void> {
  let created = 0;
  let skipped = 0;

  for (const h of HOLIDAYS_2026) {
    const dateObj = new Date(h.date + 'T00:00:00.000Z');

    const existing = await prisma.holiday.findUnique({
      where: { date: dateObj },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma.holiday.create({
      data: {
        date: dateObj,
        name: h.name,
        type: h.type,
      },
    });
    created++;
  }

  if (created > 0) {
    console.log(`[Holiday] 2026년 공휴일 ${created}개 추가 (${skipped}개 기존 건너뜀)`);
  } else {
    console.log(`[Holiday] 2026년 공휴일 이미 등록됨 (${skipped}개)`);
  }
}
