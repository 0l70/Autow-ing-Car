package com.project.domain.user.repository;

import com.project.domain.common.UserRole;
import com.project.domain.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);

    Optional<User> findByEmployeeCode(String employeeCode);

    Optional<User> findByUsername(String username);

    boolean existsByEmail(String email);

    boolean existsByEmployeeCode(String employeeCode);

    java.util.List<User> findAllByRole(UserRole role);
}
