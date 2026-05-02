"""
SENTINEL-X Data Export Utilities
Export data to various formats
"""
import json
import csv
import io
from datetime import datetime
from typing import Optional, Any
from dataclasses import asdict

class DataExporter:
    """Export data to various formats"""
    
    @staticmethod
    def to_json(data: list, pretty: bool = True) -> str:
        """Export to JSON"""
        if pretty:
            return json.dumps(data, indent=2, default=str)
        return json.dumps(data, default=str)
    
    @staticmethod
    def to_csv(data: list[dict], fields: Optional[list] = None) -> str:
        """Export to CSV"""
        if not data:
            return ""
        
        output = io.StringIO()
        
        if fields is None:
            fieldnames = list(data[0].keys()) if data else []
        else:
            fieldnames = fields
        
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        
        for row in data:
            writer.writerow({k: row.get(k, "") for k in fieldnames})
        
        return output.getvalue()
    
    @staticmethod
    def to_csv_string(data: list[dict]) -> str:
        """Export dataclasses to CSV"""
        if not data:
            return ""
        
        output = io.StringIO()
        fieldnames = list(data[0].keys())
        
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        
        for row in data:
            clean_row = {}
            for k, v in row.items():
                clean_row[k] = str(v) if v is not None else ""
            writer.writerow(clean_row)
        
        return output.getvalue()


class ReportGenerator:
    """Generate intelligence reports"""
    
    @staticmethod
    def generate_threat_summary(threats: list) -> dict:
        """Generate threat summary"""
        severity_counts = {}
        type_counts = {}
        
        for threat in threats:
            severity = threat.get("severity", "unknown")
            severity_counts[severity] = severity_counts.get(severity, 0) + 1
            
            threat_type = threat.get("threat_type", "unknown")
            type_counts[threat_type] = type_counts.get(threat_type, 0) + 1
        
        return {
            "total_threats": len(threats),
            "by_severity": severity_counts,
            "by_type": type_counts,
            "generated_at": datetime.utcnow().isoformat(),
        }
    
    @staticmethod
    def generate_entity_summary(entities: list) -> dict:
        """Generate entity summary"""
        type_counts = {}
        risk_counts = {}
        
        for entity in entities:
            entity_type = entity.get("entity_type", "unknown")
            type_counts[entity_type] = type_counts.get(entity_type, 0) + 1
            
            risk = entity.get("risk_level", "unknown")
            risk_counts[risk] = risk_counts.get(risk, 0) + 1
        
        return {
            "total_entities": len(entities),
            "by_type": type_counts,
            "by_risk": risk_counts,
            "generated_at": datetime.utcnow().isoformat(),
        }


def export_threats_json(threats: list) -> str:
    """Export threats to JSON"""
    return DataExporter.to_json(threats)


def export_threats_csv(threats: list) -> str:
    """Export threats to CSV"""
    return DataExporter.to_csv(threats)


def export_entities_json(entities: list) -> str:
    """Export entities to JSON"""
    return DataExporter.to_json(entities)


def export_entities_csv(entities: list) -> str:
    """Export entities to CSV"""
    return DataExporter.to_csv(entities)


def generate_report(threats: list, entities: list) -> dict:
    """Generate full report"""
    return {
        "threat_summary": ReportGenerator.generate_threat_summary(threats),
        "entity_summary": ReportGenerator.generate_entity_summary(entities),
        "generated_at": datetime.utcnow().isoformat(),
    }


if __name__ == "__main__":
    test_threats = [
        {"id": "1", "severity": "critical", "threat_type": "aircraft_incursion"},
        {"id": "2", "severity": "high", "threat_type": "vessel_incident"},
    ]
    
    print("JSON Export:")
    print(export_threats_json(test_threats))
    
    print("\nCSV Export:")
    print(export_threats_csv(test_threats))