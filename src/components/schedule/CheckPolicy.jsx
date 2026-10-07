import React, { useState } from 'react';
import { Table, Checkbox } from 'flowbite-react';
import UnderArrow from '../../assets/icons/under_arrow_black.png';
import { useAllPolicies } from '../../api/roomOperationPolicy.api';
import { operationEndTimeLabel } from '../../utils/reservationTimeLabel';

const CheckPolicy = ({ selectedPolicyId, setSelectedPolicyId }) => {
  const { data: policies, refetch } = useAllPolicies();
  const [isTableVisible, setIsTableVisible] = useState(false);

  const handlePolicyCheckBox = policyId => {
    setSelectedPolicyId(policyId === selectedPolicyId ? null : policyId);
  };

  return (
    <div>
      <div className="flex flex-row items-center gap-x-2">
        <div>Room Policy</div>
        <img
          onClick={() => setIsTableVisible(!isTableVisible)}
          className={`w-6 h-6 cursor-pointer transition-transform duration-300 hover:scale-125 ${isTableVisible ? 'rotate-180' : ''}`}
          src={UnderArrow}
        />
      </div>
      {isTableVisible && policies && (
        <div className="overflow-x-auto mt-4">
          <Table>
            <Table.Head className="text-center">
              <Table.HeadCell className="cursor-pointer bg-gray-200"></Table.HeadCell>
              <Table.HeadCell className="cursor-pointer bg-gray-200">
                Policy ID
              </Table.HeadCell>
              <Table.HeadCell className="cursor-pointer bg-gray-200">
                운영 시작 시간
              </Table.HeadCell>
              <Table.HeadCell className="cursor-pointer bg-gray-200">
                운영 종료 시간
              </Table.HeadCell>
              <Table.HeadCell className="cursor-pointer bg-gray-200">
                최대 사용 시간(분)
              </Table.HeadCell>
            </Table.Head>
            <Table.Body className="text-center divide-y">
              {policies?.map(policy => (
                <Table.Row
                  key={policy.roomOperationPolicyId}
                  className="bg-white dark:border-gray-700 dark:bg-gray-800 cursor-pointer hover:bg-gray-50">
                  <Table.Cell className="p-4">
                    <Checkbox
                      className="rounded-none text-[#1D2430] focus:ring-[#1D2430] cursor-pointer"
                      checked={
                        selectedPolicyId === policy.roomOperationPolicyId
                      }
                      onChange={() =>
                        handlePolicyCheckBox(policy.roomOperationPolicyId)
                      }
                    />
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap font-medium text-gray-900 dark:text-white">
                    {policy.roomOperationPolicyId}
                  </Table.Cell>
                  <Table.Cell>{policy.operationStartTime}</Table.Cell>
                  <Table.Cell>{operationEndTimeLabel(policy)}</Table.Cell>
                  <Table.Cell>{policy.eachMaxMinute}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </div>
      )}
    </div>
  );
};
export default CheckPolicy;
