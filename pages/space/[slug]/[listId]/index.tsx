import { PlusIcon } from '@heroicons/react/24/outline';
import { useCreateTodo, 
        useFindManyTodo,
        useFindManyTask,
        useCreateTask,
} from '@lib/hooks';
import { List, Space } from '@prisma/client';
import BreadCrumb from 'components/BreadCrumb';
import TodoComponent from 'components/Todo';
import WithNavBar from 'components/WithNavBar';
import { GetServerSideProps } from 'next';
import { ChangeEvent, KeyboardEvent, useState } from 'react';
import { getEnhancedPrisma } from 'server/enhanced-db';

type Props = {
    space: Space;
    list: List;
};

export default function TodoList(props: Props) {
    const [selectedTaskId, setSelectedTaskId] = useState<string>('');

    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskDesc, setNewTaskDesc] = useState('');

    const { trigger: createTodo } = useCreateTodo({ optimisticUpdate: true});
    const { data: tasks = [] } = useFindManyTask({
        where: { spaceId: props.space.id },
        orderBy: { createdAt: 'desc'},
    });
    const { trigger: createTask } = useCreateTask({ optimisticUpdate: true });

    const { data: todos } = useFindManyTodo(
        {
            where: { listId: props.list.id },
            include: {
                owner: true,
                task: { select: { title: true, description: true } },
            },
            orderBy: {
                createdAt: 'desc',
            },
        },
        { keepPreviousData: true }
    );

    const _createTodo = () => {
        if (!selectedTaskId) return;
        void createTodo({
            data: {
                list: { connect: { id: props.list.id} },
                task: { connect: { id: selectedTaskId} },
            },
        });
    };

    if (!props.space || !props.list) {
        return <></>;
    }

    return (
        <WithNavBar>
            <div className="px-8 py-2">
                <BreadCrumb space={props.space} list={props.list} />
            </div>
            <div className="container w-full flex flex-col items-center py-12 mx-auto">
                <h1 className="text-2xl font-semibold mb-4">{props.list?.title}</h1>
                <div className="flex space-x-2 items-center mt-2">
                    <select
                        className="select select-bordered w-72"
                        value={selectedTaskId}
                        onChange={(e) => setSelectedTaskId(e.currentTarget.value)}
                    >
                        <option value="">- Pick a Task -</option>
                        {tasks.map((t) => (
                            <option key={t.id} value={t.id}>
                                {t.title}
                            </option>
                        ))}
                    </select>

                    <button
                        onClick={() => _createTodo()}
                        disabled={!selectedTaskId}
                        className="btn btn-outline"
                    >
                        <PlusIcon className="w-6 h-6 text-gray-500" />
                    </button>
                </div>

                <div className="flex space-x-2 items-center mt-4">
                    <input
                        type="text"
                        placeholder="New task title"
                        className="input input-bordered w-64"
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.currentTarget.value)}
                    />
                    <input  
                        type="text"
                        placeholder="Description (optional)"
                        className="input input-bordered w-80"
                        value={newTaskDesc}
                        onChange={(e) => setNewTaskDesc(e.currentTarget.value)}
                    />
                    <button
                        onClick={async () => {
                            if (!newTaskTitle.trim()) return;
                            const created = await createTask({
                                data: {
                                    title: newTaskTitle,
                                    description: newTaskDesc || undefined,
                                    space: { connect: { id: props.space.id} },
                                },
                            });
                            if (created?.id) {
                                setSelectedTaskId(created.id);
                                void createTodo({
                                    data: {
                                        list: { connect: { id: props.list.id } },
                                        task: { connect: { id: created.id } },
                                    },
                                });
                            }
                            setNewTaskTitle('');
                            setNewTaskDesc('');
                        }}
                        disabled={!newTaskTitle.trim()}
                        className="btn btn-primary"
                    >
                        <PlusIcon className="w-6 h-6 mr-1" />
                        Add Task + Todo
                    </button>
                </div>

                <ul className="flex flex-col space-y-4 py-8 w-11/12 md:w-auto">
                    {todos?.map((todo) => (
                        <TodoComponent key={todo.id} value={todo} optimistic={todo.$optimistic} />
                    ))}
                </ul>
            </div>
        </WithNavBar>
    );
}

export const getServerSideProps: GetServerSideProps<Props> = async ({ req, res, params }) => {
    const db = await getEnhancedPrisma({ req, res });
    const space = await db.space.findUnique({
        where: { slug: params!.slug as string },
    });
    if (!space) {
        return {
            notFound: true,
        };
    }

    const list = await db.list.findUnique({
        where: { id: params!.listId as string },
    });
    if (!list) {
        return {
            notFound: true,
        };
    }

    return {
        props: { space, list },
    };
};
