import type { Vehicle } from "../types/Vehicle";

type Props = {
    vehicle: Vehicle[];
};

export default function VehicleTable({ vehicle, }: Props) {
    return (
        <table>
            <thead>
                <tr>
                    <th>VIN</th>
                    <th>Type</th>
                    <th>Detail</th>
                    <th>Status</th>
                    <th>Last Location</th>
                </tr>
            </thead>

            <tbody>
                {vehicle.map((vehicle) => (
                    <tr key={vehicle.id}>
                        <td>{vehicle.vinLast8}</td>
                        <td>{vehicle.detailType}</td>
                        <td>{vehicle.status}</td>
                        <td>{vehicle.lastLocation}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}