package com.project.domain.towingcar.mapper;

import com.project.domain.towingcar.dto.TowingCarStatusResponse;
import com.project.domain.towingcar.dto.TowingCarWebSocketDtos.TowingCarDTO;
import com.project.domain.towingcar.entity.TowingCar;
import org.springframework.stereotype.Component;

@Component
public class TowingCarMapper {

    public TowingCarStatusResponse toResponseDTO(TowingCar car) {
        return TowingCarStatusResponse.builder()
                .code(car.getCode())
                .posX(car.getLastPosX() != null ? car.getLastPosX() : 0.0)
                .posY(car.getLastPosY() != null ? car.getLastPosY() : 0.0)
                .heading(car.getLastHeading() != null ? car.getLastHeading() : 0.0)
                .velocity(car.getLastVelocity() != null ? car.getLastVelocity() : 0.0)
                .battery(car.getBattery())
                .status(car.getCarStatus().name())
                .build();
    }

    public TowingCarDTO toDTO(TowingCar car) {
        return TowingCarDTO.builder()
                .code(car.getCode())
                .posX(car.getLastPosX() != null ? car.getLastPosX() : 0.0)
                .posY(car.getLastPosY() != null ? car.getLastPosY() : 0.0)
                .heading(car.getLastHeading() != null ? car.getLastHeading() : 0.0)
                .velocity(car.getLastVelocity() != null ? car.getLastVelocity() : 0.0)
                .battery(car.getBattery())
                .status(car.getCarStatus().name())
                .build();
    }
}
