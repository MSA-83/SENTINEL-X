terraform {
  required_version = ">= 1.0"
  required_providers {
    neon = {
      source  = "neondatabase/neon"
      version = "~> 1.0"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }
}

provider "neon" {
  api_key = var.neon_api_key
}

provider "cloudflare" {
  account_id = var.cloudflare_account_id
}

resource "neon_project" "main" {
  name = var.project_name
}

resource "neon_database" "main" {
  project_id = neon_project.main.id
  name      = "sentinel"
}

resource "neon_branch" "main" {
  project_id = neon_project.main.id
  name      = "main"
}

resource "cloudflare_workers_kv_namespace" "cache" {
  account_id = var.cloudflare_account_id
  title    = "${var.project_name}-cache"
}

resource "cloudflare_worker_script" "api" {
  account_id = var.cloudflare_account_id
  name       = "${var.project_name}-api"
  content   = file("${path.module}/workers/api.js")
}

output "neon_connection_string" {
  value     = neon_branch.main.connection_string
  sensitive = true
}

output "kv_namespace_id" {
  value = cloudflare_workers_kv_namespace.cache.id
}