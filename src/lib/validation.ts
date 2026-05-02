"""
SENTINEL-X Client-side Validation
"""
from typing import Optional
from dataclasses import dataclass
from enum import Enum

class ValidationType(str, Enum):
    REQUIRED = "required"
    EMAIL = "email"
    MIN_LENGTH = "min_length"
    MAX_LENGTH = "max_length"
    PATTERN = "pattern"
    RANGE = "range"
    ENUM = "enum"
    FILE_TYPE = "file_type"
    FILE_SIZE = "file_size"

@dataclass
class ValidationRule:
    type: ValidationType
    value: any
    message: str

@dataclass
class ValidationError:
    field: str
    message: str
    type: ValidationType

@dataclass
class FormState:
    values: dict
    errors: dict
    touched: set
    isValid: bool

class Validator:
    """Client-side form validation"""
    
    @staticmethod
    def required(value: any, field: str) -> Optional[ValidationError]:
        if value is None or value == "" or (isinstance(value, str) and not value.strip()):
            return ValidationError(field, f"{field} is required", ValidationType.REQUIRED)
        return None
    
    @staticmethod
    def email(value: str, field: str) -> Optional[ValidationError]:
        import re
        if value and not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", value):
            return ValidationError(field, f"{field} must be a valid email", ValidationType.EMAIL)
        return None
    
    @staticmethod
    def min_length(value: str, min_len: int, field: str) -> Optional[ValidationError]:
        if value and len(value) < min_len:
            return ValidationError(field, f"{field} must be at least {min_len} characters", ValidationType.MIN_LENGTH)
        return None
    
    @staticmethod
    def max_length(value: str, max_len: int, field: str) -> Optional[ValidationError]:
        if value and len(value) > max_len:
            return ValidationError(field, f"{field} must be at most {max_len} characters", ValidationType.MAX_LENGTH)
        return None
    
    @staticmethod
    def file_type(file: any, allowed: list, field: str) -> Optional[ValidationError]:
        if file and file.type not in allowed:
            return ValidationError(field, f"{field} must be one of: {', '.join(allowed)}", ValidationType.FILE_TYPE)
        return None
    
    @staticmethod
    def file_size(file: any, max_bytes: int, field: str) -> Optional[ValidationError]:
        if file and file.size > max_bytes:
            mb = max_bytes / (1024 * 1024)
            return ValidationError(field, f"{field} must be less than {mb}MB", ValidationType.FILE_SIZE)
        return None


class FormValidator:
    """Multi-field form validation"""
    
    def __init__(self):
        self.rules: dict[str, list] = {}
    
    def add_field(self, field: str, rules: list):
        self.rules[field] = rules
    
    def validate(self, data: dict) -> dict:
        errors = {}
        
        for field, rules in self.rules.items():
            value = data.get(field)
            
            for rule in rules:
                if isinstance(rule, tuple):
                    rule_type, rule_value, message = rule
                    error = self._apply_rule(field, value, rule_type, rule_value, message)
                else:
                    error = Validator.required(value, field)
                
                if error:
                    errors[field] = error.message
                    break
        
        return errors
    
    def _apply_rule(self, field: str, value, rule_type: ValidationType, rule_value: any, message: str) -> Optional[ValidationError]:
        if rule_type == ValidationType.REQUIRED:
            return Validator.required(value, field)
        elif rule_type == ValidationType.EMAIL:
            return Validator.email(value, field)
        elif rule_type == ValidationType.MIN_LENGTH:
            return Validator.min_length(value, rule_value, field)
        elif rule_type == ValidationType.MAX_LENGTH:
            return Validator.max_length(value, rule_value, field)
        return None


# Predefined validators
CASE_CREATE_VALIDATOR = FormValidator()
CASE_CREATE_VALIDATOR.add_field("title", [
    (ValidationType.REQUIRED, None, "Title is required"),
    (ValidationType.MIN_LENGTH, 3, "Title must be at least 3 characters"),
    (ValidationType.MAX_LENGTH, 200, "Title must be at most 200 characters"),
])

CASE_CREATE_VALIDATOR.add_field("description", [
    (ValidationType.REQUIRED, None, "Description is required"),
    (ValidationType.MIN_LENGTH, 10, "Description must be at least 10 characters"),
])

CASE_CREATE_VALIDATOR.add_field("priority", [
    (ValidationType.REQUIRED, None, "Priority is required"),
    (ValidationType.ENUM, ["critical", "high", "medium", "low"], "Invalid priority"),
])

ENTITY_CREATE_VALIDATOR = FormValidator()
ENTITY_CREATE_VALIDATOR.add_field("name", [
    (ValidationType.REQUIRED, None, "Name is required"),
    (ValidationType.MIN_LENGTH, 2, "Name must be at least 2 characters"),
])

ENTITY_CREATE_VALIDATOR.add_field("entity_type", [
    (ValidationType.REQUIRED, None, "Entity type is required"),
])

THREAT_CREATE_VALIDATOR = FormValidator()
THREAT_CREATE_VALIDATOR.add_field("title", [
    (ValidationType.REQUIRED, None, "Title is required"),
])

THREAT_CREATE_VALIDATOR.add_field("severity", [
    (ValidationType.REQUIRED, None, "Severity is required"),
    (ValidationType.ENUM, ["critical", "high", "medium", "low"], "Invalid severity"),
])


def validate_form(validator: FormValidator, data: dict) -> dict:
    """Validate form data"""
    return validator.validate(data)


def validate_field(value: any, rules: list) -> Optional[str]:
    """Validate single field"""
    for rule in rules:
        if isinstance(rule, tuple):
            rule_type, rule_value, message = rule
            error = Validator._apply_rule("", value, rule_type, rule_value, message)
        else:
            error = Validator.required(value, "")
        
        if error:
            return error.message
    
    return None