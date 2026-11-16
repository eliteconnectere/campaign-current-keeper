"""Retired migration helper.

Hotspot membership is no longer capped at two people. The live implementation
uses an unlimited member list while atomically reserving at least one Gmail
slot per member from the owner's subscription pool. Keep this script as a
no-op so an old manual workflow dispatch cannot reintroduce the retired cap.
"""

print("No patch applied: hotspot member count is unlimited; Gmail allocations are enforced by the shared plan pool.")
