import { Route, Routes } from 'react-router-dom';
import ClientDetail from './ClientDetail';
import ClientsList from './ClientsList';

export default function ClientsRoutes() {
  return (
    <Routes>
      <Route index element={<ClientsList />} />
      <Route path=":id" element={<ClientDetail />} />
    </Routes>
  );
}
