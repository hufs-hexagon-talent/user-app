import { durationLabel } from './durationLabel';

describe('durationLabel', () => {
  it('30분 단위는 분으로만 표시한다', () => {
    expect(durationLabel(30)).toBe('30분');
  });

  it('정각 시간은 시간으로만 표시한다', () => {
    expect(durationLabel(60)).toBe('1시간');
  });

  it('시간과 분이 섞이면 함께 표시한다', () => {
    expect(durationLabel(90)).toBe('1시간 30분');
  });

  it('두 시간도 시간으로만 표시한다', () => {
    expect(durationLabel(120)).toBe('2시간');
  });

  it('0분은 빈 문자열로 다룬다', () => {
    expect(durationLabel(0)).toBe('');
  });

  it('음수는 빈 문자열로 다룬다', () => {
    expect(durationLabel(-30)).toBe('');
  });

  it('숫자가 아니면 빈 문자열로 다룬다', () => {
    expect(durationLabel(NaN)).toBe('');
    expect(durationLabel(undefined)).toBe('');
  });
});
