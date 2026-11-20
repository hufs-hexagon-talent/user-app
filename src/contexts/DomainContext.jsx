import React, { createContext, useContext, useEffect } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';

// DomainContext 생성
export const DomainContext = createContext();

// getDomainFromHostname 함수: hostname을 기반으로 도메인 결정
export const getDomainFromHostname = hostname => {
  if (hostname.includes('computer')) {
    return 'ces';
  } else if (hostname.includes('ice')) {
    return 'ice';
  }
  // 기본값 'ces' 반환 (로컬 스토리지는 이미 useLocalStorage에서 관리됨)
  return 'ces';
};

// DomainProvider 컴포넌트
export const DomainProvider = ({ children }) => {
  // useLocalStorage 훅을 사용하여 domain 상태를 관리 (로컬 스토리지와 동기화됨)
  const [domain, setDomainState] = useLocalStorage('domain', 'ces');

  useEffect(() => {
    // 브라우저의 hostname 기반으로 도메인 결정 후 설정
    const currentDomain = getDomainFromHostname(window.location.hostname);
    if (domain !== 'ces' && domain !== 'ice') {
      // 로컬 스토리지 값이 'ces' 또는 'ice'가 아닌 경우 도메인을 설정
      setDomainState(currentDomain);
    }
  }, [domain, setDomainState]);

  // 도메인을 설정하는 함수
  const setDomainValue = newDomain => {
    // newDomain 값을 'ces' 또는 'ice'로 변환
    const transformedDomain = getDomainFromHostname(newDomain);
    setDomainState(transformedDomain); // 로컬 스토리지에 저장 및 상태 업데이트
  };

  return (
    <DomainContext.Provider value={{ domain, setDomainValue }}>
      {children}
    </DomainContext.Provider>
  );
};

// useDomain 훅: Context에서 도메인 값을 쉽게 사용할 수 있도록 도와줌
export const useDomain = () => {
  const context = useContext(DomainContext);

  if (context === undefined) {
    throw new Error('useDomain must be used within a DomainProvider');
  }

  return context;
};
