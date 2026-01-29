package com.project.global.error.domain.user;

import com.project.global.error.exception.ResourceNotFoundException;

public class UserException extends ResourceNotFoundException {

    public UserException(String message) {
        super("User not found: " + message);
    }

    public UserException(String message, Throwable cause) {
        super("User not found: " + message, cause);
    }

}
