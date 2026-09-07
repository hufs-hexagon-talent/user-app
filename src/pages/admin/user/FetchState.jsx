import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button, Checkbox, Modal, Table } from 'flowbite-react';
import { Input, Pagination } from '@mui/material';
import {
  useUnblocked,
  useBlockedUser,
  useUserRoleList,
  exportUserExcel,
  useUserSearch,
  useUserUpdate,
} from '../../../api/user.api';
import { useDepartmets } from '../../../api/department.api';
import { useAllRooms } from '../../../api/room.api';
import { useCustomSnackbars } from '../../../components/snackbar/SnackBar';
import { FaFileExcel } from 'react-icons/fa6';
import { updateUserErrorMessage } from './updateUserMessage';

const FetchState = () => {
  const navigate = useNavigate();

  const [input, setInput] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(30);
  const [userList, setUserList] = useState([]);
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null); // 체크된 userId (단일)

  const [editname, setEditName] = useState('');
  const [editUserName, setEditUserName] = useState('');
  const [editSerial, setEditSerial] = useState('');
  const [editServiceRole, setEditServiceRole] = useState('');
  const [editDepartmentId, setEditDepartmentId] = useState(null);
  const [editEmail, setEditEmail] = useState('');
  const [editRoomId, setEditRoomId] = useState(null);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [openBlockedModal, setOpenBlockedModal] = useState(false);
  const [selectedBlockedInfo, setSelectedBlockedInfo] = useState(null);
  const [searchParams] = useSearchParams();
  const { openSuccessSnackbar, openErrorSnackbar } = useCustomSnackbars();

  const { data: departments } = useDepartmets();
  const { data: rooms, isError: roomsFailed } = useAllRooms();
  const { data: blocked } = useBlockedUser();
  const { data: userRoleList } = useUserRoleList();
  const { mutate: doUnblocked, refetch } = useUnblocked();
  const { mutate: userSearch } = useUserSearch();
  const { mutateAsync: userUpdate } = useUserUpdate();

  // 페이지 누를때 상태 관리
  const handlePage = (event, newPage) => {
    setCurrentPage(newPage);
  };

  // URL에 따라 role 필터 선택
  useEffect(() => {
    const queryRoles = searchParams.getAll('role');
    if (queryRoles.length > 0) {
      setSelectedRoles(queryRoles);
    }
  }, []);

  // 블락 해제 함수
  const handleUnblocked = async userId => {
    await doUnblocked(userId, {
      onSuccess: () => {
        openSuccessSnackbar('블락 해제 되었습니다.', 3000);
        refetch();
      },
      onError: error => {
        // 서버 원문을 그대로 띄우지 않는다. 만료는 SessionExpiryWatcher 가 안내하므로
        // 여기서 또 띄우면 중복이다.
        if (error?.sessionExpired) return;
        openErrorSnackbar(
          '블락 해제에 실패했습니다. 잠시 뒤 다시 시도해 주세요.',
          3000,
        );
      },
    });
  };

  // serviceRole 선택
  const handleRoleSelect = role => {
    setCurrentPage(1);
    setSelectedRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role],
    );
  };

  // 유저 조회
  const fetchUsers = () => {
    const isNumeric = !isNaN(input);
    const payload = {
      page: currentPage - 1,
      ...(selectedRoles.length > 0 && { role: selectedRoles }),
      ...(input && {
        ...(isNumeric ? { serial: input } : { name: input }),
      }),
    };

    userSearch(payload, {
      onSuccess: res => {
        const { items, meta } = res.data;
        setUserList(items || []);
        setTotalPages(meta.totalPages);
        setPageSize(meta.size);
      },
      onError: error => {
        if (error?.sessionExpired) return;
        openErrorSnackbar(
          '유저 목록을 불러오지 못했습니다. 잠시 뒤 다시 시도해 주세요.',
          3000,
        );
      },
    });
  };

  // 유저 정보 수정
  const handleUserUpdate = async userId => {
    // 승격 시점에만 담당 호실이 필수다. 백필에서 빠져 담당이 없는 관리실 계정도
    // 이름·이메일만 고칠 수 있어야 해서 이미 RESIDENT 인 계정은 막지 않는다.
    const promoting =
      editServiceRole === 'RESIDENT' &&
      userList.find(user => user.userId === userId)?.serviceRole !== 'RESIDENT';
    if (promoting && !editRoomId) {
      openErrorSnackbar(
        '관리실 계정으로 바꾸려면 담당 호실을 지정해 주세요.',
        3000,
      );
      return;
    }

    try {
      const data = await userUpdate({
        userId,
        username: editUserName,
        serial: editSerial,
        serviceRole: editServiceRole,
        name: editname,
        email: editEmail,
        departmentId: editDepartmentId,
        // 관리실 계정이 아니면 호실 키 자체를 빼야 한다. 강등 저장에 예전 호실이
        // 실려 나가면 서버가 거절한다.
        ...(editServiceRole === 'RESIDENT' && editRoomId
          ? { roomId: editRoomId }
          : {}),
      });

      openSuccessSnackbar(data.message, 3000);

      setEditModalOpen(false);
      setSelectedUserId(null);
      setEditName('');
      setEditUserName('');
      setEditSerial('');
      setEditEmail('');
      setEditServiceRole('');
      setEditDepartmentId(null);
      setEditRoomId(null);
      fetchUsers();
    } catch (err) {
      console.error('유저 정보 수정 실패:', err);
      const message = updateUserErrorMessage(err);
      if (message) openErrorSnackbar(message, 3000);
    }
  };

  const handleCheckboxChange = user => {
    // 토글: 이미 선택된 유저를 다시 클릭하면 해제
    if (selectedUserId === user.userId) {
      setSelectedUserId(null);
      setEditRoomId(null);
    } else {
      setSelectedUserId(user.userId);
      setEditName(user.name);
      setEditUserName(user.username);
      setEditSerial(user.serial);
      setEditEmail(user.email);
      setEditServiceRole(user.serviceRole);
      setEditDepartmentId(user.departmentId);
      setEditRoomId(user.roomId ?? null);
    }
  };

  // 입력할 떄마다 & Enter 키 입력 시 유저 조회
  const handleSearchUser = () => {
    setCurrentPage(1); // 검색 시 1페이지로
    fetchUsers();
  };

  // 체크박스 또는 페이지가 바뀌면 유저 목록 다시 가져오기
  useEffect(() => {
    fetchUsers();
  }, [selectedRoles, currentPage, input]);

  return (
    <div className="overflow-x-auto">
      {/* Blocked User List */}
      <div>
        <div className="font-bold text-3xl text-black p-8">Users State</div>
        <div className="flex flex-row items-center mx-5 mb-6">
          <div className="mr-3">학번 또는 이름 </div>
          <input
            className="border rounded-sm w-32 h-7"
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                handleSearchUser();
              }
            }}
            type="text"
            maxLength="9"
          />
        </div>
        <div className="flex justify-between items-center">
          {/* Role Checkbox */}
          <div className="flex flex-row gap-x-6 items-center px-4 pb-8">
            {userRoleList?.map(role => (
              <div key={role} className="flex flex-row gap-x-2 items-center">
                <Checkbox
                  checked={selectedRoles.includes(role)}
                  onChange={() => handleRoleSelect(role)}
                  className="rounded-none text-[#1D2430] focus:ring-[#1D2430]"
                />
                <div>{role}</div>
              </div>
            ))}
          </div>

          <div className="flex flex-row items-center space-x-4">
            {/* 사용자 추가 */}
            <Button
              color="dark"
              className="cursor-pointer"
              onClick={() => navigate('/manage/sign-up')}>
              사용자 추가
            </Button>
            {/* 회원 정보 수정 버튼 */}
            {selectedUserId && (
              <Button color="dark" onClick={() => setEditModalOpen(true)}>
                수정
              </Button>
            )}
            {/* Export Excel */}
            <Button
              className="bg-[#009900]"
              onClick={() => {
                if (selectedRoles.length === 0) {
                  openErrorSnackbar('역할을 하나 이상 선택해주세요.');
                  return;
                }
                exportUserExcel(selectedRoles);
              }}>
              <div className="flex flex-row gap-x-3 items-center">
                <FaFileExcel />
                <div className="break-keep">내보내기</div>
              </div>
            </Button>
          </div>
        </div>
        {/* Users Table */}
        <Table>
          <Table.Head className="text-center">
            <Table.HeadCell className="bg-gray-200"></Table.HeadCell>
            <Table.HeadCell className="bg-gray-200">User Id</Table.HeadCell>
            <Table.HeadCell className="bg-gray-200">
              Service Role
            </Table.HeadCell>
            <Table.HeadCell className="bg-gray-200">학번</Table.HeadCell>
            <Table.HeadCell className="bg-gray-200">이름</Table.HeadCell>
            <Table.HeadCell className="bg-gray-200">학과</Table.HeadCell>
            <Table.HeadCell className="bg-gray-200">담당 호실</Table.HeadCell>
            <Table.HeadCell className="bg-gray-200">이메일</Table.HeadCell>
            {userList.some(user => user.serviceRole === 'BLOCKED') && (
              <Table.HeadCell className="bg-gray-200">
                <span className="sr-only">삭제</span>
              </Table.HeadCell>
            )}
          </Table.Head>
          <Table.Body className="divide-y text-center">
            {userList.map((user, index) => (
              <Table.Row
                key={index}
                className="bg-white cursor-pointer hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
                <Table.Cell className="w-4">
                  <Checkbox
                    checked={selectedUserId === user.userId}
                    onChange={() => handleCheckboxChange(user)}
                    className="rounded-none text-[#1D2430] focus:ring-[#1D2430]"
                  />
                </Table.Cell>
                <Table.Cell
                  onClick={() => {
                    if (user.serviceRole === 'BLOCKED') {
                      const blockedInfo = blocked?.find(
                        b => b.userInfoResponse.userId === user.userId,
                      );
                      setSelectedBlockedInfo(blockedInfo);
                      setOpenBlockedModal(true);
                    }
                  }}
                  className={`whitespace-nowrap font-medium text-gray-900 dark:text-white
                    ${user.serviceRole === 'BLOCKED' ? 'cursor-pointer hover:underline' : ''}
                  `}>
                  {user.userId}
                </Table.Cell>
                <Table.Cell
                  onClick={() =>
                    navigate(`/manage/fetchReservations/${user.userId}`)
                  }>
                  {user.serviceRole}
                </Table.Cell>
                <Table.Cell
                  onClick={() =>
                    navigate(`/manage/fetchReservations/${user.userId}`)
                  }>
                  {user.serial ?? '-'}
                </Table.Cell>
                <Table.Cell
                  onClick={() =>
                    navigate(`/manage/fetchReservations/${user.userId}`)
                  }>
                  {user.name}
                </Table.Cell>
                <Table.Cell
                  onClick={() =>
                    navigate(`/manage/fetchReservations/${user.userId}`)
                  }>
                  {user.departmentId === 1 ? '컴퓨터공학부' : '정보통신공학과'}
                </Table.Cell>
                <Table.Cell
                  onClick={() =>
                    navigate(`/manage/fetchReservations/${user.userId}`)
                  }>
                  {user.roomName ?? '-'}
                </Table.Cell>
                <Table.Cell
                  onClick={() =>
                    navigate(`/manage/fetchReservations/${user.userId}`)
                  }>
                  {user.email ?? '-'}
                </Table.Cell>
                {user.serviceRole === 'BLOCKED' ? (
                  <Table.Cell>
                    <a
                      onClick={() => handleUnblocked(user.userId)}
                      className="font-medium text-red-600 cursor-pointer hover:underline dark:text-cyan-500">
                      삭제
                    </a>
                  </Table.Cell>
                ) : (
                  userList.some(u => u.serviceRole === 'BLOCKED') && (
                    <Table.Cell />
                  )
                )}
              </Table.Row>
            ))}
          </Table.Body>
        </Table>

        {/* Pagination */}
        <div className="flex justify-center mt-4">
          <Pagination
            count={totalPages}
            page={currentPage}
            onChange={handlePage}
            shape="rounded"
          />
        </div>

        {/* 유저 정보 수정 모달 */}
        <Modal show={editModalOpen} onClose={() => setEditModalOpen(false)}>
          <Modal.Header>
            <strong>#{selectedUserId}</strong> 유저 정보 수정
          </Modal.Header>
          <Modal.Body>
            <Table>
              <Table.Body>
                <Table.Row>
                  <Table.Cell className="border-b border-gray-300 bg-gray-200 font-semibold text-black">
                    유저 ID
                  </Table.Cell>
                  <Table.Cell className="border-b border-gray-300">
                    {selectedUserId}
                  </Table.Cell>
                </Table.Row>
                <Table.Row>
                  <Table.Cell className="border-b border-gray-300 bg-gray-200 font-semibold text-black">
                    이름
                  </Table.Cell>
                  <Table.Cell className="border-b border-gray-300">
                    <Input
                      fullWidth
                      value={editname}
                      onChange={e => setEditName(e.target.value)}
                    />
                  </Table.Cell>
                </Table.Row>
                <Table.Row>
                  <Table.Cell className="border-b border-gray-300 bg-gray-200 font-semibold text-black">
                    USERNAME
                  </Table.Cell>
                  <Table.Cell className="border-b border-gray-300">
                    <Input
                      fullWidth
                      value={editUserName}
                      onChange={e => setEditUserName(e.target.value)}
                    />
                  </Table.Cell>
                </Table.Row>
                <Table.Row>
                  <Table.Cell className="border-b border-gray-300 bg-gray-200 font-semibold text-black">
                    학번
                  </Table.Cell>
                  <Table.Cell className="border-b border-gray-300">
                    <Input
                      fullWidth
                      value={editSerial}
                      onChange={e => setEditSerial(e.target.value)}
                    />
                  </Table.Cell>
                </Table.Row>
                <Table.Row>
                  <Table.Cell className="border-b border-gray-300 bg-gray-200 font-semibold text-black">
                    ROLE
                  </Table.Cell>
                  <Table.Cell className="border-b border-gray-300">
                    <select
                      className="w-full border rounded-md px-2 py-1"
                      aria-label="ROLE"
                      value={editServiceRole}
                      onChange={e => {
                        const nextRole = e.target.value;
                        setEditServiceRole(nextRole);
                        // 관리실이 아닌 역할로 내리면 담당 호실을 즉시 비운다.
                        // 남겨 두면 강등 저장에 예전 호실이 실려 나간다.
                        if (nextRole !== 'RESIDENT') setEditRoomId(null);
                      }}>
                      <option value="">선택</option>
                      {userRoleList?.map(role => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </Table.Cell>
                </Table.Row>

                <Table.Row>
                  <Table.Cell className="border-b border-gray-300 bg-gray-200 font-semibold text-black">
                    이메일
                  </Table.Cell>
                  <Table.Cell className="border-b border-gray-300">
                    <Input
                      fullWidth
                      value={editEmail}
                      onChange={e => setEditEmail(e.target.value)}
                    />
                  </Table.Cell>
                </Table.Row>
                <Table.Row>
                  <Table.Cell className="border-b border-gray-300 bg-gray-200 font-semibold text-black">
                    부서
                  </Table.Cell>
                  <Table.Cell className="border-b border-gray-300">
                    <select
                      className="w-full border rounded-md px-2 py-1"
                      aria-label="부서"
                      value={editDepartmentId ?? ''}
                      onChange={e =>
                        setEditDepartmentId(
                          e.target.value === '' ? null : Number(e.target.value),
                        )
                      }>
                      {/* Number('') 은 0 이 되어 없는 학과로 나간다. 값을 비우는 경로는
                          서버에 없으므로 '선택' 은 아예 고를 수 없게 둔다. */}
                      <option value="" disabled>
                        선택
                      </option>
                      {departments?.map(dept => (
                        <option
                          key={dept.departmentId}
                          value={dept.departmentId}>
                          {dept.departmentName}
                        </option>
                      ))}
                    </select>
                  </Table.Cell>
                </Table.Row>
                <Table.Row>
                  <Table.Cell className=" bg-gray-200 font-semibold text-black">
                    담당 호실
                  </Table.Cell>
                  <Table.Cell>
                    <select
                      className="w-full border rounded-md px-2 py-1 disabled:bg-gray-100 disabled:text-gray-400"
                      aria-label="담당 호실"
                      disabled={editServiceRole !== 'RESIDENT'}
                      value={editRoomId ?? ''}
                      onChange={e =>
                        setEditRoomId(
                          e.target.value === '' ? null : Number(e.target.value),
                        )
                      }>
                      {/* 담당을 비우는 경로는 서버에 없다. '선택' 은 '아직 안 골랐다' 는 뜻이라
                          되돌려 고를 수 없게 둔다. 이미 RESIDENT 인 계정에서 이걸 다시 고르면
                          승격 가드도 전송 가드도 지나쳐 roomId 없이 PATCH 가 나가고, 서버는 옛
                          호실을 유지한 채 200 을 준다 — 관리자는 바뀐 줄 알고 성공 스낵바만 본다. */}
                      <option value="" disabled>
                        선택
                      </option>
                      {/* 호실 이름(306 등)은 부서마다 겹치므로 부서명을 같이 적는다. */}
                      {rooms?.map(room => (
                        <option key={room.roomId} value={room.roomId}>
                          {room.departmentName
                            ? `${room.roomName} (${room.departmentName})`
                            : room.roomName}
                        </option>
                      ))}
                    </select>
                    {editServiceRole !== 'RESIDENT' && (
                      <div className="mt-1 text-xs text-gray-500">
                        관리실(RESIDENT) 계정만 담당 호실을 지정합니다.
                      </div>
                    )}
                    {/* 목록을 못 불러오면 고를 항목이 하나도 없다. 승격은 담당 호실을
                        요구하므로 원인을 못 짚으면 막다른 길이 된다. */}
                    {editServiceRole === 'RESIDENT' && roomsFailed && (
                      <div className="mt-1 text-xs text-red-500">
                        호실 목록을 불러오지 못했습니다. 새로 고친 뒤 다시
                        시도해 주세요.
                      </div>
                    )}
                  </Table.Cell>
                </Table.Row>
              </Table.Body>
            </Table>

            <div className="flex justify-end mt-4">
              <Button
                color="dark"
                onClick={() => handleUserUpdate(selectedUserId)}>
                수정
              </Button>
            </div>
          </Modal.Body>
        </Modal>

        {/* 회원 블락 기간 조회 모달 */}
        <Modal
          className="flex justify-center items-center w-full"
          show={openBlockedModal}
          onClose={() => {
            setOpenBlockedModal(false);
            setSelectedBlockedInfo(null);
          }}>
          <Modal.Header>
            {selectedBlockedInfo?.userInfoResponse.name}의 Blocked Period
          </Modal.Header>
          <Modal.Body>
            <Table>
              <Table.Head className="text-center text-md">
                <Table.HeadCell>User Id</Table.HeadCell>
                <Table.HeadCell>이름</Table.HeadCell>
                <Table.HeadCell>블락 시작일</Table.HeadCell>
                <Table.HeadCell>블락 종료일</Table.HeadCell>
              </Table.Head>
              <Table.Body className="divide-y text-center text-lg">
                <Table.Row
                  key={selectedBlockedInfo?.userInfoResponse.userId}
                  className="bg-white dark:border-gray-700 dark:bg-gray-800">
                  <Table.Cell>
                    {selectedBlockedInfo?.userInfoResponse.userId}
                  </Table.Cell>
                  <Table.Cell>
                    {selectedBlockedInfo?.userInfoResponse.name}
                  </Table.Cell>
                  <Table.Cell>
                    {selectedBlockedInfo?.startBlockedDate}
                  </Table.Cell>
                  <Table.Cell>{selectedBlockedInfo?.endBlockedDate}</Table.Cell>
                </Table.Row>
              </Table.Body>
            </Table>
          </Modal.Body>
        </Modal>
      </div>
    </div>
  );
};

export default FetchState;
