import React from 'react';
import { Link } from 'react-router-dom';

import { summarizeStatus, useServiceStatus } from '../../api/serviceStatus.api';

const DOT_CLASS = {
  up: 'bg-green-500',
  warn: 'bg-yellow-400',
  down: 'bg-red-500',
  unknown: 'bg-gray-300',
};

// 관리자 화면 어디에 있든 서비스가 살아 있는지 눈에 들어오게 하는 자리다.
// 알림 메일은 한 사람에게만 가므로, 메일을 받지 않는 운영자가
// 이상을 알아채는 통로가 이 배지뿐이다.
const ServiceStatusBadge = () => {
  const { data, isPending, isError } = useServiceStatus();

  const summary = isError
    ? { level: 'unknown', text: '상태 확인 불가' }
    : summarizeStatus(data);

  const level = isPending ? 'unknown' : summary.level;
  const text = isPending ? '확인 중' : summary.text;

  return (
    <Link
      to="/manage/service-status"
      className="block border-t border-gray-200 px-4 py-3 hover:bg-gray-100">
      <div className="text-xs text-gray-500">서비스 상태</div>
      <div className="mt-1 flex items-center">
        <span
          className={`mr-2 inline-block h-2.5 w-2.5 shrink-0 rounded-full ${DOT_CLASS[level]}`}
        />
        <span className="text-sm text-gray-700">{text}</span>
      </div>
    </Link>
  );
};

export default ServiceStatusBadge;
