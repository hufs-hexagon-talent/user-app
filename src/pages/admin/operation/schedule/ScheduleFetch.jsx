import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pagination } from '@mui/material';
import { Table } from 'flowbite-react';
import {
  fetchDate,
  fetchScheduleByDate,
} from '../../../../api/policySchedule.api';
import { format } from 'date-fns';

const ScheduleFetch = () => {
  const DEPARTMENT_ID = 1;
  const navigate = useNavigate();

  const [availableDate, setAvailableDate] = useState([]);
  const [selectedSchedule, setSelectedSchedule] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  useEffect(() => {
    const getDate = async () => {
      const dates = await fetchDate(DEPARTMENT_ID);
      setAvailableDate(dates);
    };
    getDate();
  }, []);

  // 날짜 별 스케줄 로드 함수
  useEffect(() => {
    const loadSchedule = async () => {
      if (selectedDate) {
        const data = await fetchScheduleByDate(
          format(new Date(selectedDate), 'yyyy-MM-dd'),
        );
        setSelectedSchedule(data);
      }
    };

    loadSchedule();
  }, [selectedDate]);

  // 페이지네이션
  const handlePageChange = (event, value) => {
    setCurrentPage(value);
  };

  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedDates = availableDate?.slice(
    startIndex,
    startIndex + itemsPerPage,
  );
  const totalPages = Math.ceil(availableDate.length / itemsPerPage);

  return (
    <div>
      <div className="font-bold text-3xl text-black px-4 py-8">
        Fetch Schedule
      </div>
      <div className="bg-white shadow-md p-8 lg:w-1/2 rounded-xl ">
        <div className="font-bold text-xl">현재 운영 정책이 설정된 날짜</div>
        <div className="mt-8">
          <Table className="mx-auto">
            <Table.Body className="divide-y">
              {paginatedDates?.map((date, index) => {
                const formattedDate = format(date, 'yyyy-MM-dd'); // ← 세미콜론 필수

                return (
                  <Table.Row
                    key={index}
                    className="cursor-pointer bg-white"
                    onClick={() => {
                      setSelectedDate(date);
                      navigate(`/manage/schedule/fetch/${formattedDate}`);
                    }}>
                    <Table.Cell className="text-gray-600 text-lg">
                      {format(date, 'yyyy년 MM월 dd일')}
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table>

          <div className="flex justify-center mt-4">
            <Pagination
              count={totalPages}
              page={currentPage}
              onChange={handlePageChange}
              shape="rounded"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScheduleFetch;
