import { Button } from 'flowbite-react';
import React, { useState } from 'react';

// endLocked: 종료가 정해져 있을 때(자정까지 운영) 한 번 누르기로 시작만 고른다. 종료는 부모가 정한다.
const TimeSelector = ({ setStartTime, setEndTime, endLocked = false }) => {
  const [startSelectedTime, setStartSelectedTime] = useState(null); // 시작 시간
  const [endSelectedTime, setEndSelectedTime] = useState(null); // 종료 시간
  const [isSelectingStart, setIsSelectingStart] = useState(true); // 지금 클릭하는 게 시작 시간인지 종료 시간인지 구분

  // 시간 슬롯 (0시 ~ 23시 30분) 생성
  const timeSlots = Array.from({ length: 48 }, (_, i) => {
    const hour = Math.floor(i / 2);
    const minute = (i % 2) * 30;
    return `${hour.toString().padStart(2, '0')}:${minute === 0 ? '00' : '30'}`; // 짝수이면 00, 홀수이면 30
  });

  // 시간 블록 하나 클릭했을 때 실행되는 함수
  const handleTimeClick = time => {
    if (endLocked) {
      setStartSelectedTime(time);
      setEndSelectedTime(null);
      if (setStartTime) setStartTime(time);
      return;
    }
    if (isSelectingStart) {
      // 시작 시간 선택 했다면
      setStartSelectedTime(time); // 클릭한 시간을 시작 시간으로 저장
      setEndSelectedTime(null); // 종료 시간 초기화 (null)
      setIsSelectingStart(false); // 다음 클릭은 종료 시간 선택으로 변경
    } else {
      if (time === startSelectedTime) {
        // 종료시간 선택중이면
        resetSelection(); // 선택 초기화
      } else {
        // 시작 시간과 다른 시간이라면 startSelectedTime과 endSelectedTime을 시와 분으로 나눔
        const [startH, startM] = startSelectedTime.split(':').map(Number);
        const [endH, endM] = time.split(':').map(Number);

        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;

        // 시작 시간이 종료 시간보다 늦으면 선택 초기화
        if (startMinutes > endMinutes) {
          resetSelection();
        } else {
          setEndSelectedTime(time); // 종료 시간 설정

          // 부모로 시작-종료 시간 전달
          if (setStartTime && setEndTime) {
            setStartTime(startSelectedTime);
            setEndTime(time);
          }
        }
        setIsSelectingStart(true); // 다음 클릭을 다시 시작 시간을 선택하게
      }
    }
  };

  const isTimeInSelectedRange = time => {
    if (!startSelectedTime && !endSelectedTime) return false;

    const [currH, currM] = time.split(':').map(Number);
    const currMinutes = currH * 60 + currM;

    // 종료가 잠겼으면 고른 시작부터 하루 끝까지 칠한다
    if (endLocked) {
      const [startH, startM] = startSelectedTime.split(':').map(Number);
      return currMinutes >= startH * 60 + startM;
    }

    if (startSelectedTime && !endSelectedTime) {
      const [startH, startM] = startSelectedTime.split(':').map(Number);
      const startMinutes = startH * 60 + startM;
      return currMinutes === startMinutes;
    }

    if (startSelectedTime && endSelectedTime) {
      const [startH, startM] = startSelectedTime.split(':').map(Number);
      const [endH, endM] = endSelectedTime.split(':').map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;
      return startMinutes <= currMinutes && currMinutes <= endMinutes;
    }

    return false;
  };

  // 초기화 함수
  const resetSelection = () => {
    setStartSelectedTime(null);
    setEndSelectedTime(null);
    setIsSelectingStart(true);
  };
  return (
    <div className="flex flex-col space-y-4">
      <div className="h-96 overflow-y-scroll border rounded-lg p-4 bg-white">
        {timeSlots.map(time => (
          <div
            key={time}
            onClick={() => handleTimeClick(time)}
            className={`p-3 my-1 rounded-md cursor-pointer text-center font-medium ${isTimeInSelectedRange(time) ? 'bg-gray-300' : 'bg-gray-100 hover:bg-gray-200'}`}>
            {time}
          </div>
        ))}
      </div>
      {/* <div className="flex space-x-6 justify-between">
        <Button
          onClick={resetSelection}
          className="bg-red-500 hover:bg-red-600 text-white rounded">
          선택 초기화
        </Button>
      </div> */}
    </div>
  );
};

export default TimeSelector;
