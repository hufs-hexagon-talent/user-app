import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStatics } from '../../../api/user.api';

const UserStatics = () => {
  const navigate = useNavigate();
  const { data: userStatics } = useUserStatics();

  // 쿼리 포함하여 이동
  const handleNavigateWithRoles = roles => {
    const query = roles.map(role => `role=${role}`).join('&');
    navigate(`/manage/user-state?${query}`);
  };

  return (
    <div>
      <div className="font-bold text-3xl text-black p-8">User Statics</div>
      <div>
        {/* 이용자 수 통계 */}
        <div className="flex flex-col gap-y-6 lg:w-1/2 bg-white shadow-md rounded-2xl p-8 mb-6">
          <div
            className="cursor-pointer"
            onClick={() =>
              handleNavigateWithRoles([
                'USER',
                'ADMIN',
                'RESIDENT',
                'BLOCKED',
                'EXPIRED',
              ])
            }>
            <div className="text-gray-500 text-sm">전체 이용자 수</div>
            <div className="text-2xl font-bold">
              {userStatics?.totalUserCount}
            </div>
          </div>
          <div
            className="cursor-pointer"
            onClick={() => handleNavigateWithRoles(['USER', 'BLOCKED'])}>
            <div className="text-gray-500 text-sm">활성화 된 이용자 수</div>
            <div className="text-2xl font-bold">
              {userStatics?.activeUserCount}
            </div>
          </div>
          <div
            className="cursor-pointer"
            onClick={() => handleNavigateWithRoles(['BLOCKED'])}>
            <div className="text-gray-500 text-sm">Blocked 이용자 수</div>
            <div className="text-2xl font-bold">
              {userStatics?.bannedUserCount}
            </div>
          </div>
          <div
            className="cursor-pointer"
            onClick={() => handleNavigateWithRoles(['EXPIRED'])}>
            <div className="text-gray-500 text-sm">만료된 이용자 수</div>
            <div className="text-2xl font-bold">
              {userStatics?.expiredUserCount}
            </div>
          </div>
          <div
            className="cursor-pointer"
            onClick={() => handleNavigateWithRoles(['ADMIN'])}>
            <div className="text-gray-500 text-sm">관리자 계정 수</div>
            <div className="text-2xl font-bold">
              {userStatics?.adminUserCount}
            </div>
          </div>
          <div
            className="cursor-pointer"
            onClick={() => handleNavigateWithRoles(['RESIDENT'])}>
            <div className="text-gray-500 text-sm">시스템 계정 수</div>
            <div className="text-2xl font-bold">
              {userStatics?.systemUserCount}
            </div>
          </div>
        </div>
        {/* 예약 수 통계 */}
      </div>
    </div>
  );
};

export default UserStatics;
