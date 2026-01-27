package com.project.domain.map.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.project.domain.map.entity.Edge;

@Repository
public interface EdgeRepository extends JpaRepository<Edge, Long> {

}
