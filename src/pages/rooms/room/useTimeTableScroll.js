import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

// 표를 열거나 날짜를 바꿀 때 원하는 열로 맞추고, 가장자리에 더 있는지 알린다.
const useTimeTableScroll = ({ scrollToIndex, resetKey, columnCount }) => {
  const containerRef = useRef(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const updateEdges = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const left = el.scrollLeft > 1;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    // 값이 그대로면 이전 객체를 돌려줘 스크롤 이벤트마다 표 전체가 리렌더되지 않게 한다
    setEdges(prev =>
      prev.left === left && prev.right === right ? prev : { left, right },
    );
  }, []);

  // 칸 폭이 화면 크기마다 달라서 인덱스 x 폭으로 계산하지 않고 실제 위치를 잰다
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const target = el.querySelector(
      `thead [data-time-index="${scrollToIndex}"]`,
    );
    const sticky = el.querySelector('[data-sticky-col]');
    if (target) {
      el.scrollLeft = Math.max(
        0,
        target.offsetLeft - (sticky?.offsetWidth ?? 0),
      );
    }
    updateEdges();
    // columnCount 는 실제로 참조하지 않지만 의도적으로 넣었다: 열이 빈 표에서 채워진 표로 바뀌면
    // (예: scrollToIndex 가 우연히 0 그대로인 날짜) scrollToIndex/resetKey 만으로는 이 효과가 다시
    // 돌지 않아 가장자리 표시가 빈 표 기준 값으로 굳어 버린다. "안 쓰는 의존성"이라 지우지 말 것.
  }, [scrollToIndex, resetKey, columnCount, updateEdges]);

  useEffect(() => {
    const onResize = () => updateEdges();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [updateEdges]);

  return { containerRef, edges, handleScroll: updateEdges };
};

export default useTimeTableScroll;
