import { useCallback, useRef, useState } from 'react';

// --- 옵션 인터페이스 ---
interface Options {
    shouldPreventDefault?: boolean; // 기본 동작 방지 여부
    delay?: number; // 롱프레스 인식 시간 (ms)
}

// 터치 이벤트 확인 함수
const isTouchEvent = (event: React.SyntheticEvent | Event): event is React.TouchEvent => {
    return 'touches' in event;
};

const preventDefault = (event: React.SyntheticEvent | Event) => {
    if (!isTouchEvent(event)) return;

    if (event.touches.length < 2 && event.preventDefault) {
        event.preventDefault();
    }
};

/**
 * 롱프레스(Long Press) 훅
 * @param onLongPress 지정된 시간(delay)만큼 눌렀을 때 실행될 함수
 * @param onClick 짧게 눌렀을 때(일반 클릭) 실행될 함수
 * @param options 설정 옵션 (default: preventDefault=true, delay=1000ms)
 */
export default function useLongPress(
    onLongPress: (event: React.SyntheticEvent | Event) => void,
    onClick: (event: React.SyntheticEvent | Event) => void,
    { shouldPreventDefault = true, delay = 1000 }: Options = {}
) {
    const [longPressTriggered, setLongPressTriggered] = useState(false);
    const timeout = useRef<NodeJS.Timeout>();
    const target = useRef<EventTarget>();

    const start = useCallback(
        (event: React.SyntheticEvent | Event) => {
            // 터치 이벤트의 경우 기본 동작(스크롤 등) 방지
            if (shouldPreventDefault && event.target) {
                event.target.addEventListener('touchend', preventDefault, {
                    passive: false,
                });
                target.current = event.target;
            }
            // 롱프레스 타이머 시작
            timeout.current = setTimeout(() => {
                onLongPress(event);
                setLongPressTriggered(true);
            }, delay);
        },
        [onLongPress, delay, shouldPreventDefault]
    );

    const clear = useCallback(
        (event: React.SyntheticEvent | Event, shouldTriggerClick = true) => {
            // 타이머 취소
            timeout.current && clearTimeout(timeout.current);
            // 롱프레스가 발생하지 않았고, 클릭 트리거가 true인 경우 클릭 핸들러 실행
            if (shouldTriggerClick && !longPressTriggered) {
                onClick(event);
            }
            setLongPressTriggered(false);
            // 이벤트 리스너 정리
            if (shouldPreventDefault && target.current) {
                target.current.removeEventListener('touchend', preventDefault);
            }
        },
        [shouldPreventDefault, onClick, longPressTriggered]
    );

    return {
        onMouseDown: (e: React.SyntheticEvent) => start(e),
        onTouchStart: (e: React.SyntheticEvent) => start(e),
        onMouseUp: (e: React.SyntheticEvent) => clear(e),
        onMouseLeave: (e: React.SyntheticEvent) => clear(e, false),
        onTouchEnd: (e: React.SyntheticEvent) => clear(e),
    };
}
