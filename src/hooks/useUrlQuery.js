import { useLocation, useNavigate } from 'react-router-dom';

// 주소의 쿼리 값 하나를 읽고 쓴다. 값은 렌더할 때마다 주소에서 읽는다.
// 주소에 값이 없으면 그때의 기본값을 쓰므로, 기본값이 바뀌면(자정에 오늘 날짜가 바뀌는 경우 등) 값도 따라 바뀐다.
// 세 번째 값은 주소에 값이 적혀 있는지다. 기본값을 쓰는 중이면 false 다.
function useUrlQuery(param, defaultValue = '') {
  const location = useLocation();
  const navigate = useNavigate();

  const queryValue = new URLSearchParams(location.search).get(param);
  const value = queryValue || defaultValue;

  const updateQuery = newValue => {
    const params = new URLSearchParams(location.search);
    if (newValue) {
      params.set(param, newValue);
    } else {
      params.delete(param);
    }
    navigate(`?${params.toString()}`, { replace: true });
  };

  return [value, updateQuery, !!queryValue];
}

export default useUrlQuery;
