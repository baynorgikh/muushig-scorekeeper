import { Link } from 'react-router-dom';
import { Spade } from 'lucide-react';
import { Button, Empty } from '../components/ui';

export default function NotFoundPage() {
  return (
    <Empty
      icon={<Spade size={40} />}
      title="Хуудас олдсонгүй"
      action={
        <Link to="/">
          <Button>Нүүр хуудас</Button>
        </Link>
      }
    />
  );
}
