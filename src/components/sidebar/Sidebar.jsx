import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  HiChartPie,
  HiUser,
  HiClipboardCheck,
  HiCalendar,
  HiFilm,
} from 'react-icons/hi';
import { AnimatePresence, motion } from 'framer-motion';

import ServiceStatusBadge from './ServiceStatusBadge';

const menuData = [
  {
    label: '통계 및 현황',
    icon: HiChartPie,
    children: [
      { label: '사용자 통계', to: '/manage/user-statics' },
      { label: '예약 통계', to: '/manage/reservation-statics' },
    ],
  },
  {
    label: '사용자 관리',
    icon: HiUser,
    children: [{ label: '사용자 상태 관리', to: '/manage/user-state' }],
  },
  {
    label: '예약 관리',
    icon: HiClipboardCheck,
    children: [{ label: '예약 상태 관리', to: '/manage/reservation-state' }],
  },
  {
    label: '운영 관리',
    icon: HiCalendar,
    children: [
      { label: '정책 관리', to: '/manage/policy' },
      {
        label: '운영 시간 관리',
        children: [
          { label: '스케줄 생성', to: '/manage/schedule/create' },
          { label: '스케줄 조회', to: '/manage/schedule/fetch' },
        ],
      },
      {
        label: '시설 관리',
        children: [
          { label: 'Room', to: '/manage/facility/room' },
          { label: 'Partition', to: '/manage/facility/partition' },
        ],
      },
    ],
  },
  {
    label: '배너 관리',
    icon: HiFilm,
    children: [
      { label: '배너 생성', to: '/manage/banner/create' },
      { label: '배너 관리', to: '/manage/banner/manage' },
    ],
  },
];

const SidebarItem = ({ item, depth = 1 }) => {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const isActive = location.pathname === item.to;
  const hasChildren = Array.isArray(item.children) && item.children.length > 0;
  const padding = `pl-${depth * 4}`;

  return (
    <li className={`${padding} py-2`}>
      {hasChildren ? (
        <button className="w-full text-left" onClick={() => setOpen(!open)}>
          {item.label}
        </button>
      ) : item.to ? (
        <Link
          to={item.to}
          className={`block px-2 py-1 rounded ${
            isActive ? 'bg-gray-100 font-semibold mr-6' : ''
          }`}>
          {item.label}
        </Link>
      ) : (
        <span className="block text-gray-400 cursor-not-allowed">
          {item.label}
        </span>
      )}

      {hasChildren && open && (
        <motion.ul
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="mt-1">
          {item.children.map((child, index) => (
            <SidebarItem key={index} item={child} depth={depth + 1} />
          ))}
        </motion.ul>
      )}
    </li>
  );
};

const SidebarSection = ({ section }) => {
  const [open, setOpen] = useState(false);
  const Icon = section.icon;

  return (
    <div>
      <button
        className="w-full flex items-center px-4 py-2 hover:bg-gray-200"
        onClick={() => setOpen(!open)}>
        <Icon className="mr-2" />
        <span>{section.label}</span>
      </button>
      {open && (
        <div className="ml-4">
          <ul>
            {section.children.map((child, index) => (
              <SidebarItem key={index} item={child} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

// 사이드바 바깥에 overflow-y-auto 를 두면 상태 배지의 sticky 기준이
// 그 안쪽 스크롤로 바뀌어 화면 아래에 붙지 않는다. 메뉴는 화면 높이를
// 넘지 않으므로 스크롤을 떼고 페이지 스크롤을 기준으로 삼는다.
const CustomSidebar = ({ isVisible = true }) => {
  return (
    <AnimatePresence mode="wait">
      {isVisible && (
        <motion.div
          key="sidebar"
          initial={{ x: -300, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -300, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 30 }}
          className="bg-white w-64 min-w-[16rem] shrink-0 grow-0 basis-64 flex flex-col">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            className="flex flex-1 flex-col py-4">
            <div className="mt-4 flex-1">
              {menuData.map((section, index) => (
                <SidebarSection key={index} section={section} />
              ))}
            </div>
            {/* 관리자 화면은 본문이 길어 스크롤이 생긴다. 배지를 화면 아래에
                붙여 두어야 어느 위치에서 보든 상태가 눈에 들어온다. */}
            <div className="sticky bottom-0 bg-white">
              <ServiceStatusBadge />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CustomSidebar;
