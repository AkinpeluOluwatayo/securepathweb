"use client";

import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Circle, Popup, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import 'leaflet-routing-machine';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import 'lrm-graphhopper';

import MarkerClusterGroup from 'react-leaflet-cluster';
import toast from 'react-hot-toast';
import { Navigation, LocateFixed } from 'lucide-react';

if (typeof window !== 'undefined') {
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    });
}

function GraphHopperRouting({ dangerZones = [], waypoints = [] }) {
    const map = useMap();

    useEffect(() => {
        if (!map || typeof window === 'undefined') return;
        if (!waypoints || waypoints.length < 2) return;

        try {
            const routingWaypoints = waypoints.map(wp => L.latLng(wp.lat, wp.lng));

            const routingControl = L.Routing.control({
                waypoints: routingWaypoints,
                router: L.Routing.graphHopper(process.env.NEXT_PUBLIC_GRAPHHOPPER_API_KEY, {
                    urlParameters: {
                        "ch.disable": true,
                    }
                }),
                routeWhileDragging: true,
                addWaypoints: true,
                show: true,
                lineOptions: {
                    styles: [{ color: '#27AE60', opacity: 0.9, weight: 6, dashArray: '10, 10' }],
                    zIndex: 400
                },
                createMarker: function (i, wp) {
                    return L.marker(wp.latLng, {
                        draggable: true,
                        zIndexOffset: 600
                    });
                }
            }).addTo(map);

            return () => {
                if (map && routingControl) {
                    map.removeControl(routingControl);
                }
            };
        } catch (e) {
            console.error("Failed to initialize GraphHopper routing:", e);
        }
    }, [map, dangerZones, waypoints]);

    return null;
}

function MapClickHandler({ onMapClick }) {
    useMapEvents({
        click: (e) => {
            if (e?.latlng) {
                onMapClick(e.latlng);
            }
        },
    });
    return null;
}

function MapAutoCenter({ waypoints = [] }) {
    const map = useMap();
    useEffect(() => {
        if (waypoints.length === 0) return;
        const dest = waypoints.length > 1 ? waypoints[waypoints.length - 1] : waypoints[0];
        map.flyTo([dest.lat, dest.lng], 15, { duration: 1.2 });
    }, [map, waypoints]);
    return null;
}

function RecenterControl({ startPoint }) {
    const map = useMap();
    const handleRecenter = () => {
        if (!startPoint) {
            toast.error("Home position not established.");
            return;
        }
        map.flyTo([startPoint.lat, startPoint.lng], 13, { duration: 1.2 });
    };

    return (
        <div className="leaflet-top leaflet-right" style={{ marginTop: '100px', marginRight: '16px' }}>
            <div className="leaflet-control">
                <button
                    onClick={handleRecenter}
                    className="w-10 h-10 bg-[#04120a] border-2 border-[#27AE60]/40 rounded-xl flex items-center justify-center text-[#27AE60] hover:bg-[#27AE60] hover:text-[#04120a] pointer-events-auto"
                >
                    <LocateFixed size={18} />
                </button>
            </div>
        </div>
    );
}

export default function TacticalMap({ reports = [], waypoints = [], onReportSubmit }) {
    const [selectedCoords, setSelectedCoords] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [reportData, setReportData] = useState({ status: 'DANGER', description: '' });
    const [isLocating, setIsLocating] = useState(false);

    const dangerZones = (reports || []).filter(r => {
        const status = r?.properties?.status || r?.status;
        return status === 'DANGER';
    });

    const handleInitiateReport = () => {
        if (!navigator.geolocation) {
            toast.error("Geolocation not supported.");
            return;
        }
        setIsLocating(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setSelectedCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
                setIsLocating(false);
                setShowModal(true);
            },
            () => {
                setIsLocating(false);
                toast.error("Unable to verify position.");
            },
            { enableHighAccuracy: true }
        );
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onReportSubmit({
            latitude: selectedCoords.lat,
            longitude: selectedCoords.lng,
            status: reportData.status,
            description: reportData.description
        });
        setShowModal(false);
        setReportData({ status: 'DANGER', description: '' });
    };

    return (
        <div className="flex flex-col gap-8 w-full">
            <div className="relative h-[650px] w-full rounded-3xl overflow-hidden border-2 border-[#27AE60]/20 shadow-2xl bg-[#04120a]">
                <MapContainer center={[9.0820, 8.6753]} zoom={6} className="h-full w-full z-0">
                    <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    />

                    <GraphHopperRouting dangerZones={dangerZones} waypoints={waypoints} />
                    <MapAutoCenter waypoints={waypoints} />
                    <RecenterControl startPoint={waypoints[0]} />
                    <MapClickHandler onMapClick={(latlng) => console.log("Map Click:", latlng)} />

                    <MarkerClusterGroup>
                        {(reports || []).map((report) => {
                            const lat = report.latitude || report?.geometry?.coordinates[1];
                            const lng = report.longitude || report?.geometry?.coordinates[0];
                            if (lat == null || lng == null) return null;

                            return (
                                <Circle
                                    key={report.id || Math.random()}
                                    center={[lat, lng]}
                                    pathOptions={{
                                        fillColor: (report.status || report.properties?.status) === 'DANGER' ? '#ef4444' : '#22c55e',
                                        color: '#ffffff',
                                        weight: 2,
                                        fillOpacity: 0.6
                                    }}
                                    radius={500}
                                >
                                    <Popup>{report.description || report.properties?.description}</Popup>
                                </Circle>
                            );
                        })}
                    </MarkerClusterGroup>
                </MapContainer>

                {showModal && (
                    <div className="absolute inset-0 z-[2000] flex items-center justify-center bg-black/70 backdrop-blur-md">
                        <div className="bg-[#04120a] border border-[#27AE60]/40 p-8 rounded-3xl w-full max-w-md">
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setReportData({ ...reportData, status: 'DANGER' })}
                                        className={`py-4 rounded-2xl text-white font-black text-[10px] uppercase tracking-widest ${reportData.status === 'DANGER' ? 'bg-red-600' : 'bg-white/5'}`}
                                    >
                                        Danger
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setReportData({ ...reportData, status: 'SAFE' })}
                                        className={`py-4 rounded-2xl text-white font-black text-[10px] uppercase tracking-widest ${reportData.status === 'SAFE' ? 'bg-[#27AE60]' : 'bg-white/5'}`}
                                    >
                                        Safe
                                    </button>
                                </div>
                                <textarea
                                    required
                                    value={reportData.description}
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white text-sm"
                                    onChange={(e) => setReportData({ ...reportData, description: e.target.value })}
                                />
                                <button type="submit" className="w-full bg-white text-black py-4 rounded-2xl font-black uppercase text-xs">Share Update</button>
                            </form>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex justify-center pb-12">
                <button
                    onClick={handleInitiateReport}
                    disabled={isLocating}
                    className="bg-[#27AE60] text-[#04120a] px-12 py-5 rounded-full font-black uppercase tracking-[0.3em] shadow-2xl transition-all active:scale-95"
                >
                    {isLocating ? 'Acquiring Fix...' : 'Share Field Condition'}
                </button>
            </div>
        </div>
    );
}