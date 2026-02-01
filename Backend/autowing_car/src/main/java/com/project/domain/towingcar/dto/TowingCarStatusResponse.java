package com.project.domain.towingcar.dto;

import lombok.*;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TowingCarStatusResponse {
    private String code;
    private Double posX;
    private Double posY;
    private Double heading;
    private Double velocity;
    private Integer battery;
    private String status; // IDLE, TOWING, MOVING...
}
