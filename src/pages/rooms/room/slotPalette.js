// 칸 상태별 색과 라벨. 시각 정리는 이 파일만 고친다.
// 밝은 색 = 예약 가능, 빗금 회색 = 예약 불가, 진한 색 = 이미 예약됨, 밝은 파랑 = 내 예약.
// past 와 closed 는 getSlotState 에서는 구분되지만(도메인상 다른 사유), 학생에게는
// 둘 다 "지금 예약할 수 없다"는 같은 의미라 화면에서는 일부러 같은 모양으로 보여준다.
export const SLOT_PALETTE = {
  free: { background: '#F1EEE9', pattern: null },
  selected: { background: '#7599BA', pattern: null },
  mine: { background: '#2F7DC4', pattern: null },
  reserved: { background: '#002D56', pattern: null },
  past: {
    background: '#C7C4C0',
    pattern:
      'repeating-linear-gradient(45deg, transparent 0 4px, rgba(0,0,0,0.05) 4px 8px)',
  },
  closed: {
    background: '#C7C4C0',
    pattern:
      'repeating-linear-gradient(45deg, transparent 0 4px, rgba(0,0,0,0.05) 4px 8px)',
  },
};

export const SLOT_LABEL = {
  free: '예약 가능',
  selected: '예약 선택',
  mine: '내 예약',
  reserved: '예약 완료',
  past: '예약 불가',
  closed: '예약 불가',
};

// 범례에 세우는 항목. covers 는 이 한 줄이 대신 설명하는 상태들이다.
export const LEGEND = [
  { key: 'free', label: '예약 가능', covers: ['free'] },
  { key: 'mine', label: '내 예약', covers: ['mine'] },
  { key: 'reserved', label: '예약 완료', covers: ['reserved'] },
  { key: 'past', label: '예약 불가', covers: ['past', 'closed'] },
];

// 선택 중인 칸은 방금 사용자가 직접 누른 것이라 범례로 설명할 필요가 없다.
export const LEGEND_OMITTED = ['selected'];
