package com.project.domain.map.repository;

import com.project.domain.map.entity.MapInfo;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface MapInfoRepository extends JpaRepository<MapInfo, Long> {
    Optional<MapInfo> findByBasicMapTrue();
}
