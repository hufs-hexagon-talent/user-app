import { format } from 'date-fns';

import {
  FUTURE_MESSAGE,
  TOO_OLD_MESSAGE,
  occurredAtProblem,
  toDateTimeLocal,
  toInstant,
} from './occurredAt';

const NOW = new Date('2026-09-05T14:00:00');
const local = date => format(date, "yyyy-MM-dd'T'HH:mm");

describe('occurredAtProblem', () => {
  it('빈 값은 지정 안 함이라 문제없다', () => {
    expect(occurredAtProblem('', NOW)).toBeNull();
  });

  it('지금보다 5분 넘게 뒤면 미래', () => {
    expect(
      occurredAtProblem(local(new Date(NOW.getTime() + 4 * 60 * 1000)), NOW),
    ).toBeNull();
    expect(
      occurredAtProblem(local(new Date(NOW.getTime() + 6 * 60 * 1000)), NOW),
    ).toBe(FUTURE_MESSAGE);
  });

  it('30일보다 오래되면 범위 밖', () => {
    expect(
      occurredAtProblem(
        local(new Date(NOW.getTime() - 29 * 24 * 60 * 60 * 1000)),
        NOW,
      ),
    ).toBeNull();
    expect(
      occurredAtProblem(
        local(new Date(NOW.getTime() - 31 * 24 * 60 * 60 * 1000)),
        NOW,
      ),
    ).toBe(TOO_OLD_MESSAGE);
  });

  it('해석할 수 없는 값은 미래 문구가 아니라 확인 문구다', () => {
    expect(occurredAtProblem('not-a-date', NOW)).toBe(
      '발생 시각을 다시 확인해 주세요.',
    );
  });
});

// 기대값은 한국 시간대(UTC+9) 리터럴로 고정한다(jest.globalSetup.js 가 TZ 를 맞춘다). new Date() 로
// 계산한 기대값은 CI(UTC) 에서 변환을 빼먹은 구현(슬라이스·'Z' 붙이기)도 통과시킨다.
describe('변환', () => {
  it('datetime-local 값을 ISO(UTC) 로, 빈 값은 null 로', () => {
    expect(toInstant('')).toBeNull();
    expect(toInstant('2026-09-05T13:40')).toBe('2026-09-05T04:40:00.000Z');
  });

  it('서버 ISO 를 로컬 datetime-local 값으로 되돌린다(왕복)', () => {
    expect(toDateTimeLocal('2026-09-05T04:40:00.000Z')).toBe(
      '2026-09-05T13:40',
    );
    expect(toDateTimeLocal(null)).toBe('');
  });
});
