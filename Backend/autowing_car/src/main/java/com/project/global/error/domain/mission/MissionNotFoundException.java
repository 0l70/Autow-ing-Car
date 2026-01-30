package com.project.global.error.domain.mission;

import com.project.global.error.exception.ResourceNotFoundException;

/**
 * 미션을 찾을 수 없을 때 발생하는 예외
 */
public class MissionNotFoundException extends ResourceNotFoundException {

    public MissionNotFoundException(Long missionId) {
        super("미션을 찾을 수 없습니다: ID=" + missionId);
    }
}
