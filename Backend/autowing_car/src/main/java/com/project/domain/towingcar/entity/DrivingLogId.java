package com.project.domain.towingcar.entity;

import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import java.io.Serializable;
import java.time.LocalDateTime;

@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class DrivingLogId implements Serializable {
    private Long id;
    private LocalDateTime createdAt;
}
