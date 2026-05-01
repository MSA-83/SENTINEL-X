variable "project_name" {
  description = "SENTINEL-X project name"
  type        = string
  default     = "sentinel-x"
}

variable "region" {
  description = "Deployment region"
  type        = string
  default     = "us-east-1"
}

variable "neon_api_key" {
  description = "Neon API key"
  type        = string
  sensitive   = true
}

variable "cloudflare_account_id" {
  description = "Cloudflare account ID"
  type        = string
}

variable "redis_cloud_plan_id" {
  description = "Upstash Redis plan ID"
  type        = string
}