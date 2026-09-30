import React, { useState, useEffect } from 'react';
import 'react-datepicker/dist/react-datepicker.css';
import { Button, Table, TableBody, Modal, Checkbox } from 'flowbite-react';
import {
  useCreatePolicy,
  useAllPolicies,
  useDeletePolicy,
  usePolicy,
  useEditPolicy,
} from '../../../../api/roomOperationPolicy.api';
import { useCustomSnackbars } from '../../../../components/snackbar/SnackBar';
import 'react-datepicker/dist/react-datepicker.css';

import EachMaxMinuteSelector from '../../../../components/clock/EachMaxMinuteSelector';
import TimePicker from '../../../../components/clock/TimePicker';
import TimeSelector from '../../../../components/clock/TimeRangeSelector';
import TimeSlider from '../../../../components/clock/TimeSlider';
import {
  parseTimeValue,
  toApiTime,
} from '../../../../components/clock/timeValue';
import {
  MIDNIGHT_LABEL,
  operationEndTimeLabel,
} from '../../../../utils/reservationTimeLabel';
import {
  midnightMismatchMessage,
  policyErrorMessage,
} from './policyErrorMessage';

// 자정(24:00)까지 여는 정책의 저장 종료. 서버는 24:00 을 TIME 값으로 적지 못해 endsAtMidnight 를
// 켠 정책의 종료를 23:30:00 으로 고정한다. 이 값은 플래그를 모르는 옛 화면이 읽을 대체값이다.
const MIDNIGHT_FALLBACK_END_TIME = '23:30:00';

// 자정까지 여는 정책은 시작이 23:00 이하여야 한다(서버 PolicyTimeRules, POLICY-004).
// 옛 화면이 읽는 대체 창 [시작, 23:30) 이 비지 않게 하려는 규칙이다.
const MIDNIGHT_LATEST_START_MINUTE = 23 * 60; // 분, 23:00
const MIDNIGHT_START_MESSAGE =
  '자정까지 운영하는 정책의 시작 시각은 23:00 까지 지정할 수 있습니다.';

const startsInTimeForMidnight = apiTime => {
  const parsed = parseTimeValue(apiTime);
  if (!parsed) return false;
  return (
    Number(parsed.hour) * 60 + Number(parsed.minute) <=
    MIDNIGHT_LATEST_START_MINUTE
  );
};

const PolicyManagement = () => {
  // TimeSelector 가 넣어 주는 값은 "HH:mm" 문자열이다. 미선택을 Date 로 두면 truthy 라
  // 한 번도 고르지 않은 채로 전송돼 서버가 파싱하지 못하는 문자열이 나갔다.
  const [startTime, setStartTime] = useState(null);
  const [endTime, setEndTime] = useState(null);
  const [eachMaxMinute, setEachMaxMinute] = useState(60);
  // 자정(24:00)까지 운영. 켜면 종료 선택을 잠그고 저장 종료 23:30:00 과 endsAtMidnight true 를 보낸다.
  const [endsAtMidnight, setEndsAtMidnight] = useState(false);
  const [selectedPolicyId, setSelectedPolicyId] = useState(null);

  const [operationStartTime, setOperationStartTime] = useState('');
  const [operationEndTime, setOperationEndTime] = useState('');
  const [operationEachMaxMinute, setOperationEachMaxMinute] = useState(null);
  const [operationEndsAtMidnight, setOperationEndsAtMidnight] = useState(false);

  const [openDeleteModal, setOpenDeleteModal] = useState(null);
  const [openEditModal, setOpenEditModal] = useState(null);
  const { mutateAsync: doCreatePolicy } = useCreatePolicy();
  const { mutateAsync: doDeletePolicy } = useDeletePolicy();
  const { data: policies, refetch } = useAllPolicies();
  const { data: policy } = usePolicy(selectedPolicyId);
  const { mutate: editPolicy } = useEditPolicy();
  const { openSuccessSnackbar, openErrorSnackbar } = useCustomSnackbars();

  // 수정 판을 열 때마다 서버 값으로 다시 채운다. 저장하지 않고 닫은 값이 남으면 자정 운영 체크가
  // 서버와 다르게 보이고, 그 상태로 저장하면 의도하지 않게 자정 운영이 꺼진다.
  useEffect(() => {
    if (policy) {
      setOperationStartTime(policy.operationStartTime || '');
      setOperationEndTime(policy.operationEndTime || '');
      setOperationEachMaxMinute(policy.eachMaxMinute?.toString() || '');
      // 필드가 없는 옛 서버 응답은 꺼진 것으로 본다.
      setOperationEndsAtMidnight(policy.endsAtMidnight === true);
    }
  }, [policy, openEditModal]);

  // 자정 운영을 켜고 끄면 시간 구간을 처음부터 다시 고른다. 고르는 방식(두 번 누르기와 한 번
  // 누르기)이 달라 이전 선택을 이어 쓰면 화면과 보낼 값이 어긋난다.
  const toggleEndsAtMidnight = () => {
    setEndsAtMidnight(prev => !prev);
    setStartTime(null);
    setEndTime(null);
  };

  // 정책 생성
  const createPolicy = async () => {
    const start = toApiTime(startTime);
    const end = endsAtMidnight
      ? MIDNIGHT_FALLBACK_END_TIME
      : toApiTime(endTime);
    // 아직 고르지 않았거나 시각 형태가 아니면 서버까지 보내지 않는다.
    if (!start || !end) {
      openErrorSnackbar('시간 구간을 먼저 선택해 주세요.', 3000);
      return;
    }
    if (endsAtMidnight && !startsInTimeForMidnight(start)) {
      openErrorSnackbar(MIDNIGHT_START_MESSAGE, 3000);
      return;
    }
    // 끈 채로 만들면 필드를 보내지 않는다. 옛 서버와 새 서버 모두 꺼진 정책으로 만든다.
    const sentEndsAtMidnight = endsAtMidnight ? true : undefined;
    try {
      const response = await doCreatePolicy({
        operationStartTime: start,
        operationEndTime: end,
        eachMaxMinute: eachMaxMinute,
        endsAtMidnight: sentEndsAtMidnight,
      });
      refetch();
      const mismatch = midnightMismatchMessage(
        sentEndsAtMidnight,
        response?.data,
      );
      if (mismatch) {
        openErrorSnackbar(mismatch, 5000);
        return;
      }
      openSuccessSnackbar(response?.message, 3000);
    } catch (error) {
      const message = policyErrorMessage(
        error,
        '정책 생성 중 오류가 발생하였습니다.',
      );
      if (message) openErrorSnackbar(message, 3000);
    }
  };

  // 정책 삭제
  const deletePolicy = async policyId => {
    try {
      const response = await doDeletePolicy(policyId);
      refetch();
      openSuccessSnackbar(response?.message, 3000);
    } catch (error) {
      const message = policyErrorMessage(
        error,
        '정책 삭제 중 오류가 발생하였습니다.',
      );
      if (message) openErrorSnackbar(message, 3000);
    }
  };

  // 정책 수정
  const updatePolicy = () => {
    const start = toApiTime(operationStartTime);
    const end = operationEndsAtMidnight
      ? MIDNIGHT_FALLBACK_END_TIME
      : toApiTime(operationEndTime);
    // 빈 값을 그대로 올리면 MapStruct 가 null 로 보고 조용히 옛 값을 유지한다.
    // 관리자는 성공 스낵바만 보고 아무것도 바뀌지 않는다.
    if (!start || !end) {
      openErrorSnackbar('시작·종료 시각을 확인해 주세요.', 3000);
      return;
    }
    if (operationEndsAtMidnight && !startsInTimeForMidnight(start)) {
      openErrorSnackbar(MIDNIGHT_START_MESSAGE, 3000);
      return;
    }
    // 켜면 true, 켜져 있던 정책을 끄면 false 를 보낸다. 원래 꺼져 있고 그대로면 보내지 않는다
    // (서버가 지금 값을 유지한다).
    const wasEndsAtMidnight = policy?.endsAtMidnight === true;
    const sentEndsAtMidnight = operationEndsAtMidnight
      ? true
      : wasEndsAtMidnight
        ? false
        : undefined;
    editPolicy(
      {
        roomOperationPolicyId: selectedPolicyId,
        operationStartTime: start,
        operationEndTime: end,
        eachMaxMinute: Number(operationEachMaxMinute),
        endsAtMidnight: sentEndsAtMidnight,
      },
      {
        onSuccess: response => {
          refetch();
          setOpenEditModal(null);
          const mismatch = midnightMismatchMessage(
            sentEndsAtMidnight,
            response?.data,
          );
          if (mismatch) {
            openErrorSnackbar(mismatch, 5000);
            return;
          }
          openSuccessSnackbar('정책이 성공적으로 수정되었습니다.', 3000);
        },
        onError: error => {
          const message = policyErrorMessage(
            error,
            '정책 수정 중 오류가 발생했습니다.',
          );
          if (message) openErrorSnackbar(message, 3000);
        },
      },
    );
  };

  return (
    <div>
      <div className="font-bold text-3xl text-black px-4 py-8">
        Policy Management
      </div>
      {/* 정책 생성 */}
      <div className="bg-white p-8 inline-block rounded-xl mb-8 shadow-md w-full">
        <div className="text-2xl font-semibold">정책 생성</div>
        <div className="w-2/3 space-y-2 px-4">
          <div className="flex flex-row items-center justify-between">
            <div className="font-semibold">시간 구간 선택</div>
            {/* 최대 예약 가능 시간 */}
            <div className="w-2/3">
              <TimeSlider value={eachMaxMinute} onChange={setEachMaxMinute} />
            </div>
          </div>
          {/* 자정(24:00)까지 운영 */}
          <div className="flex flex-col gap-1 py-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="create-ends-at-midnight"
                className="rounded-none text-[#1D2430] focus:ring-[#1D2430]"
                checked={endsAtMidnight}
                onChange={toggleEndsAtMidnight}
              />
              <label
                htmlFor="create-ends-at-midnight"
                className="font-semibold">
                자정(24:00)까지
              </label>
            </div>
            {endsAtMidnight && (
              <p className="text-sm text-gray-600">
                시작 시각만 고르면 종료는 24:00 으로 정해집니다.
              </p>
            )}
          </div>
          {/* 시간 구간 선택. 자정 운영을 바꾸면 고르는 방식이 달라져 새로 그린다. */}
          <TimeSelector
            key={endsAtMidnight ? 'midnight' : 'range'}
            endLocked={endsAtMidnight}
            setStartTime={setStartTime}
            setEndTime={setEndTime}
          />
          {/* 정책 생성 버튼 */}
          <div className="flex justify-end pt-8">
            <Button
              onClick={createPolicy}
              disabled={!startTime || (!endsAtMidnight && !endTime)}
              className=" bg-gray-800 px-6 hover:bg-gray-700 text-white rounded disabled:bg-gray-200">
              생성
            </Button>
          </div>
        </div>
      </div>

      {/* 모든 정책 조회 */}
      <div className="bg-white p-4 inline-block rounded-xl mb-8 shadow-md w-full">
        <div className="flex flex-row items-center justify-between">
          <div className="text-xl p-6 font-bold">모든 정책 조회</div>
          <div>
            {selectedPolicyId && (
              <div className="flex flex-row gap-x-6">
                <Button
                  onClick={() => setOpenEditModal(selectedPolicyId)}
                  color="dark"
                  className="hover:bg-gray-700 text-white rounded">
                  수정
                </Button>
                <Button
                  onClick={() => setOpenDeleteModal(selectedPolicyId)}
                  className="bg-red-600 hover:bg-red-700 text-white rounded">
                  삭제
                </Button>
              </div>
            )}
          </div>
        </div>
        <div>
          <Table className="text-center">
            <Table.Head>
              <Table.HeadCell className="bg-gray-200"></Table.HeadCell>
              <Table.HeadCell className="bg-gray-200">정책 ID</Table.HeadCell>
              <Table.HeadCell className="bg-gray-200">시작 시각</Table.HeadCell>
              <Table.HeadCell className="bg-gray-200">종료 시각</Table.HeadCell>
              <Table.HeadCell className="bg-gray-200">
                최대 이용 시간
              </Table.HeadCell>
            </Table.Head>
            <TableBody>
              {policies?.map(policy => (
                <Table.Row
                  className="hover:bg-gray-50"
                  key={policy.roomOperationPolicyId}>
                  <Table.Cell>
                    <Checkbox
                      aria-label={`정책 ${policy.roomOperationPolicyId} 선택`}
                      className="rounded-none text-[#1D2430] focus:ring-[#1D2430]"
                      checked={
                        selectedPolicyId === policy.roomOperationPolicyId
                      }
                      onChange={() => {
                        setSelectedPolicyId(prev =>
                          prev === policy.roomOperationPolicyId
                            ? null
                            : policy.roomOperationPolicyId,
                        );
                      }}
                    />
                  </Table.Cell>
                  <Table.Cell>{policy.roomOperationPolicyId}</Table.Cell>
                  <Table.Cell>{policy.operationStartTime}</Table.Cell>
                  <Table.Cell>{operationEndTimeLabel(policy)}</Table.Cell>
                  <Table.Cell>{policy.eachMaxMinute}</Table.Cell>
                </Table.Row>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* 수정 모달 */}
      <div className="flex justify-center items-center">
        <Modal show={openEditModal} onClose={() => setOpenEditModal(false)}>
          <Modal.Header>정책 수정</Modal.Header>
          <Modal.Body>
            {policy ? (
              <Table className="w-full text-center text-sm">
                <Table.Head>
                  <Table.HeadCell className="bg-gray-200">
                    정책 ID
                  </Table.HeadCell>
                  <Table.HeadCell className="bg-gray-200">
                    시작 시각
                  </Table.HeadCell>
                  <Table.HeadCell className="bg-gray-200">
                    종료 시각
                  </Table.HeadCell>
                  <Table.HeadCell className="bg-gray-200">
                    최대 이용 시간
                  </Table.HeadCell>
                </Table.Head>
                <Table.Body>
                  <Table.Row key={policy.roomOperationPolicyId}>
                    <Table.Cell>{policy.roomOperationPolicyId}</Table.Cell>
                    <Table.Cell>
                      <TimePicker
                        value={operationStartTime}
                        onChange={setOperationStartTime}
                      />
                    </Table.Cell>
                    <Table.Cell>
                      {/* 자정까지 운영이면 종료를 고르지 않는다. 저장 종료는 23:30:00 으로 고정된다. */}
                      {operationEndsAtMidnight ? (
                        <span className="font-medium">{MIDNIGHT_LABEL}</span>
                      ) : (
                        <TimePicker
                          value={operationEndTime}
                          onChange={setOperationEndTime}
                        />
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      <EachMaxMinuteSelector
                        value={operationEachMaxMinute}
                        onChange={setOperationEachMaxMinute}
                      />
                    </Table.Cell>
                  </Table.Row>
                </Table.Body>
              </Table>
            ) : (
              <div>정책 정보를 불러오는 중입니다...</div>
            )}
            {policy && (
              <div className="mt-4 flex items-center gap-2">
                <Checkbox
                  id="edit-ends-at-midnight"
                  className="rounded-none text-[#1D2430] focus:ring-[#1D2430]"
                  checked={operationEndsAtMidnight}
                  onChange={() => setOperationEndsAtMidnight(prev => !prev)}
                />
                <label
                  htmlFor="edit-ends-at-midnight"
                  className="font-semibold">
                  자정(24:00)까지
                </label>
              </div>
            )}
            {/* 조회가 끝나기 전에는 화면의 시각 칸이 비어 있어 저장할 값이 없다 */}
            <div className="flex justify-end mt-6">
              <Button onClick={updatePolicy} color="dark" disabled={!policy}>
                수정
              </Button>
            </div>
          </Modal.Body>
        </Modal>
      </div>

      {/* 삭제 모달 */}
      <div className="flex justify-center items-center">
        <Modal
          show={openDeleteModal}
          className="flex justify-center items-center w-full p-6"
          size="md"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClose={() => setOpenDeleteModal(false)}
          popup>
          <Modal.Header />
          <div>
            <Modal.Body>
              <div className="text-center space-y-12">
                <div className="text-lg font-semibold">
                  정책을 삭제하시겠습니까?
                </div>
                <div className="flex justify-center gap-6">
                  <Button
                    onClick={() => setOpenDeleteModal(null)}
                    className="bg-gray-400 hover:bg-gray-500 text-white rounded">
                    아니요
                  </Button>
                  <Button
                    onClick={() => {
                      deletePolicy(openDeleteModal);
                      setOpenDeleteModal(null);
                    }}
                    className="bg-red-500 hover:bg-red-600 text-white rounded">
                    삭제
                  </Button>
                </div>
              </div>
            </Modal.Body>
          </div>
        </Modal>
      </div>
    </div>
  );
};

export default PolicyManagement;
